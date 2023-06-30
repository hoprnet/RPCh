import { createLogger, decodeIncomingBody } from "./utils";
import { WebSocket } from "isomorphic-ws";

const log = createLogger(["websocket"]);
const HEARTBEAT_ERROR_MSG = "heartbeat was not received";

class WebSocketHelper {
  private attemptingToReconnect: boolean = false; // whether the connection is in the process of reconnecting
  private reconnectAttempts: number = 0; // current reconnect attempts, gets reset
  private socket: WebSocket | undefined; // the socket, gets re-initialized on reconnection
  private pingTimeout: NodeJS.Timeout | undefined;
  private reconnectTimeout: NodeJS.Timeout | undefined;
  private maxTimeWithoutPing: number; // maximum ms that we allow to the connection to live without ping
  private attemptToReconnect: boolean; // whether we should attempt to reconnect
  private reconnectDelay: number; // how many ms to wait before attempting to reconnect
  private maxReconnectAttempts: number; // maximum number of reconnect attempts

  constructor(
    private url: string,
    private onEvent: (action: string, data: any) => void,
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
    this.initialize();
  }

  /**
   * Closes connection to the websocket server.
   */
  private closeInternal() {
    clearTimeout(this.pingTimeout);
    clearTimeout(this.reconnectTimeout);
  }

  /**
   * We want to close the connection,
   * and not reconnect again.
   */
  public close() {
    log.verbose("Closing regularly");
    this.attemptToReconnect = false;
    this.closeInternal();
    this.socket!.close();
  }

  /**
   * Closes connection to the websocket server.
   * Makes `waitUntilSocketOpen` reject.
   * @param error
   */
  private closeWithError(error: any) {
    log.verbose("Closing with error", error);
    this.close();
  }

  private heartbeat() {
    clearTimeout(this.pingTimeout);
    this.pingTimeout = setTimeout(() => {
      log.error(HEARTBEAT_ERROR_MSG);
      this.socket!.emit("error", new Error(HEARTBEAT_ERROR_MSG));
    }, this.maxTimeWithoutPing);
  }

  private initialize() {
    this.socket = new WebSocket(this.url);

    // fired when connection established
    this.socket.on("open", () => {
      this.onEvent("open", null);
      this.heartbeat();
    });

    // fired on incoming message
    this.socket.on("message", (event: any) => {
      const body = event.data.toString();
      // message received is an acknowledgement of a
      // message we have send, we can safely ignore this
      if (body.startsWith("ack:")) return;

      log.verbose("onMessage received body from HOPRd", body);

      let message: string | undefined;
      try {
        message = decodeIncomingBody(body);
      } catch (error) {
        log.error(error);
      }
      if (!message) return;
      log.verbose("decoded received body", message);

      this.onEvent("message", message);
    });

    // fired when connection closed due to error
    this.socket.on("error", (error: any): void => {
      log.error("onError", error.message);
      this.closeInternal();
      this.onEvent("error", error);
      if (error.message === HEARTBEAT_ERROR_MSG) {
        // always try reconnecting on heartbeat
        this.reconnectOnHeartbeatError();
      } else if (this.reconnectAttempts < this.maxReconnectAttempts) {
        // count non heartbeat reconnection attempts
        this.reconnectOnError();
      }
    });

    this.socket.on("close", (evt: any) => {
        log.normal("onClose", evt);
      this.onEvent("close", evt);
    });

    this.socket.on("ping", () => {
      log.verbose("onPing");
      this.heartbeat();
    });
  }

  private reconnectOnHeartbeatError() {
    log.normal(
      `WebSocket reconnect after heartbeat failure in ${this.reconnectDelay} ms`
    );
    this.reconnectTimeout = setTimeout(() => {
      this.initialize();
    }, this.reconnectDelay);
  }

  private reconnectOnError() {
    log.normal(
      `WebSocket reconnect after error. Attempting #${
        this.reconnectAttempts + 1
      } reconnect in ${this.reconnectDelay} ms`
    );
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.initialize();
    }, this.reconnectDelay);
  }
}

export default WebSocketHelper;
