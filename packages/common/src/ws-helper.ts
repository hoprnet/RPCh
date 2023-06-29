import { createLogger, decodeIncomingBody, DeferredPromise } from "./utils";
import { WebSocket } from "isomorphic-ws";

const log = createLogger(["websocket"]);
const HEARTBEAT_ERROR_MSG = "heartbeat was not received";

class WebSocketHelper {
  private attemptingToReconnect: boolean = false; // whether the connection is in the process of reconnecting
  private reconnectAttempts: number = 0; // current reconnect attempts, gets reset
  private socket: WebSocket; // the socket, gets re-initialized on reconnection
  private pingTimeout: NodeJS.Timeout | undefined;
  private reconnectTimeout: NodeJS.Timeout | undefined;
  private maxTimeWithoutPing: number; // maximum ms that we allow to the connection to live without ping
  private attemptToReconnect: boolean; // whether we should attempt to reconnect
  private reconnectDelay: number; // how many ms to wait before attempting to reconnect
  private maxReconnectAttempts: number; // maximum number of reconnect attempts

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
    this.maxTimeWithoutPing = options?.maxTimeWithoutPing ?? 33e3; // on HOPRd ping is every 15 seconds
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
    const waitPrms: DeferredPromise<WebSocket> = new DeferredPromise();
    return new Promise<WebSocket>((resolve, reject) => {
      switch (this.socket.readyState) {
        case WebSocket.CONNECTING:
          this.waitFromConnecting(waitPrms);
          break;
        case WebSocket.OPEN:
          waitPrms.resolve(this.socket);
          break;
        case WebSocket.CLOSING:
          waitPrms.reject("Socket closing");
          break;
        case WebSocket.CLOSED:
          waitPrms.reject("Socket already closed");
          break;
      }

      return waitPrms.promise.then(resolve).catch(reject);
    });
  }

  private waitFromConnecting(waitPrms: DeferredPromise<WebSocket>) {
    // Might be better to refactor listener handling for websockets entirely
    // For now lets attach onetime listeners to only get notified about the next event after connecting
    const removeListeners = () => {
      this.socket.removeEventListener("open", openListen);
      this.socket.removeEventListener("close", closeListen);
      this.socket.removeEventListener("error", errorListen);
    };
    const errorListen = (evt: any): void => {
      log.error("Error connecting WS", evt);
      removeListeners();
      waitPrms.reject(this.socket);
    };
    const closeListen = (evt: any) => {
      log.error(
        "Closing connecting WS with code",
        evt.code,
        "and reason",
        evt.reason
      );
      removeListeners();
      waitPrms.reject(this.socket);
    };
    const openListen = () => {
      log.normal("Listening for incoming messages from HOPRd", this.url);
      this.reconnectAttempts = 0;
      removeListeners();
      waitPrms.resolve(this.socket);
    };
    this.socket.addEventListener("open", openListen);
    this.socket.addEventListener("close", closeListen);
    this.socket.addEventListener("error", errorListen);
  }

  /**
   * Closes connection to the websocket server.
   */
  private closeInternal() {
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
        if (this.attemptingToReconnect) {
          log.verbose("WebSocket connection is still reconnecting");
          return;
        }
        this.attemptingToReconnect = true;
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
      } finally {
        this.attemptingToReconnect = false;
      }
    });

    this.socket.on("open", () => {
      this.heartbeat();
    });

    this.socket.on("ping", () => {
      log.verbose("received ping");
      this.heartbeat();
    });
  }
}

export default WebSocketHelper;
