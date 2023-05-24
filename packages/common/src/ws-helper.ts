import { createLogger, decodeIncomingBody, DeferredPromise } from "./utils";
import { WebSocket } from "isomorphic-ws";

const log = createLogger(["websocket"]);
const HEARTBEAT_ERROR_MSG = "heartbeat was not received";

class WebSocketHelper {
  private connectionIsClosing: boolean = false; // whether the connection is in the process of closing
  private reconnectAttempts: number = 0; // current reconnect attempts, gets reset
  private socket: WebSocket; // the socket, gets re-initialized on reconnection
  private pingTimeout: NodeJS.Timeout | undefined;
  private reconnectTimeout: NodeJS.Timeout | undefined;
  private maxTimeWithoutPing: number; // maximum ms that we allow to the connection to live without ping
  private attemptToReconnect: boolean; // whether we should attempt to reconnect
  private reconnectDelay: number; // how many ms to wait before attempting to reconnect
  private maxReconnectAttempts: number; // maximum number of reconnect attempts
  // resolved when a connection is open
  // rejects once it has failed connecting (including reconnect attemps)
  private waitUntilSocketOpenP: DeferredPromise<WebSocket>;

  constructor(
    private url: string,
    private onMessage: (data: string) => void,
    options?: {
      maxTimeWithoutPing?: number;
      attemptToReconnect?: boolean;
      reconnectDelay?: number;
      maxReconnectAttempts?: number;
    }
  ) {
    this.waitUntilSocketOpenP = new DeferredPromise<WebSocket>();
    this.maxTimeWithoutPing = options?.maxTimeWithoutPing ?? 60e3;
    this.attemptToReconnect = options?.attemptToReconnect ?? true;
    this.reconnectDelay = options?.reconnectDelay ?? 100;
    this.maxReconnectAttempts = options?.maxReconnectAttempts ?? 3;
    this.socket = new WebSocket(url);
    this.setUpEventHandlers();
  }

  /**
   * Resolves if we have successfully opened a connection.
   * Reject if we didn't.
   * @returns the websocket instance
   */
  public async waitUntilSocketOpen(): Promise<WebSocket> {
    return new Promise<WebSocket>((resolve, reject) => {
      // if its already open
      if (this.socket.readyState === this.socket.OPEN) {
        this.waitUntilSocketOpenP.resolve(this.socket);
      }
      // wait for it to open
      else {
        this.socket.onopen = () => {
          log.normal("Listening for incoming messages from HOPRd", this.url);
          this.reconnectAttempts = 0;
          this.waitUntilSocketOpenP.resolve(this.socket);
        };
      }

      return this.waitUntilSocketOpenP.promise.then(resolve).catch(reject);
    });
  }

  /**
   * Closes connection to the websocket server.
   */
  private closeInternal() {
    this.connectionIsClosing = true;
    clearTimeout(this.pingTimeout);
    clearTimeout(this.reconnectTimeout);
    this.socket.close();
  }

  /**
   * We want to close the connection,
   * and not reconnect again.
   */
  public close() {
    log.verbose("Closing WS");
    this.attemptToReconnect = false;
    this.closeInternal();
  }

  /**
   * Closes connection to the websocket server.
   * Makes `waitUntilSocketOpen` reject.
   * @param error
   */
  private closeWithError(error: any) {
    log.verbose("Closing WS with error", error);
    this.close();
    this.waitUntilSocketOpenP.reject(error);
  }

  private heartbeat() {
    clearTimeout(this.pingTimeout);
    this.pingTimeout = setTimeout(() => {
      log.error("did not receive heartbeat");
      this.socket.emit("error", new Error(HEARTBEAT_ERROR_MSG));
    }, this.maxTimeWithoutPing);
  }

  private setUpEventHandlers() {
    this.socket.onmessage = (event) => {
      const body = event.data.toString();
      // message received is an acknowledgement of a
      // message we have send, we can safely ignore this
      if (body.startsWith("ack:")) return;

      log.verbose("received body from HOPRd", body);

      let message: string | undefined;
      try {
        message = decodeIncomingBody(body);
      } catch (error) {
        log.error(error);
      }
      if (!message) return;
      log.verbose("decoded received body", message);

      this.onMessage(message);
    };

    this.socket.on("error", async (error) => {
      try {
        log.error("WebSocket error:", error.message);

        // close existing ws
        if (this.connectionIsClosing) {
          log.verbose("WebSocket connection is still closing");
          return;
        }
        this.closeInternal();

        // skip if we do not want to reconnect
        // if its heartbeat issue, we always want to reconnect
        if (
          error.message !== HEARTBEAT_ERROR_MSG &&
          (!this.attemptToReconnect ||
            ++this.reconnectAttempts >= this.maxReconnectAttempts)
        ) {
          throw error;
        }

        log.error(
          "WebSocket connection failed, retrying in %s ms..",
          this.reconnectDelay,
          error.message
        );
        // wait a bit before reconnection attempt
        await new Promise<void>((resolve) => {
          this.reconnectTimeout = setTimeout(resolve, this.reconnectDelay);
        });

        // reconnect: open new ws
        this.socket = new WebSocket(this.url);
        // set up event handlers again
        this.setUpEventHandlers();

        log.verbose("WebSocket reconnected");
      } catch (error) {
        // we wanted to connect but failed
        // if we don't want to reconnect
        if (!this.attemptToReconnect) {
          return this.closeWithError(`WebSocket failed to connect: ${error}`);
        }
        // max attempts were reached
        else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          return this.closeWithError(
            `WebSocket failed to connect, max attempts reached: ${error}`
          );
        } else {
          return this.closeWithError(
            `WebSocket failed to connect, unexpected error: ${error}`
          );
        }
      }
    });

    this.socket.on("open", () => {
      this.heartbeat();
    });

    this.socket.on("close", () => {
      this.connectionIsClosing = false;
    });

    this.socket.on("ping", () => {
      this.heartbeat();
    });
  }
}

export default WebSocketHelper;
