import { createLogger, decodeIncomingBody } from "./utils";
import { WebSocket } from "isomorphic-ws";

const log = createLogger(["websocket"]);
const HEARTBEAT_ERROR_MSG = "heartbeat was not received";

export type onEventParameterType =
  | { action: "open" }
  | { action: "ping" }
  | { action: "message"; message: string }
  | { action: "close"; event: CloseEvent }
  | { action: "error"; event: ErrorEvent };
export type onEventType = (evt: onEventParameterType) => void;

export default class WebSocketHelper {
  private attemptingToReconnect: boolean = false; // whether the connection is in the process of reconnecting
  private reconnectAttempts: number = 0; // current reconnect attempts, gets reset
  private socket!: WebSocket; // the socket, gets re-initialized on reconnection
  private pingTimeout: NodeJS.Timeout | undefined;
  private reconnectTimeout: NodeJS.Timeout | undefined;
  private maxTimeWithoutPing: number; // maximum ms that we allow to the connection to live without ping
  // TODO use increasing reconnect delays
  private reconnectDelay: number; // how many ms to wait before attempting to reconnect
  private maxReconnectAttempts: number; // maximum number of reconnect attempts

  constructor(
    private url: URL,
    private onEvent: onEventType,
    options?: {
      maxTimeWithoutPing?: number;
      reconnectDelay?: number;
      maxReconnectAttempts?: number;
    }
  ) {
    this.maxTimeWithoutPing = options?.maxTimeWithoutPing ?? 33e3; // on HOPRd ping is every 15 seconds
    this.reconnectDelay = options?.reconnectDelay ?? 100;
    this.maxReconnectAttempts = options?.maxReconnectAttempts ?? 3;

    this.initialize();
  }

  private initialize = () => {
    this.socket = new WebSocket(this.url);
    this.socket.on("open", this.onOpen);
    this.socket.on("close", this.onClose);
    this.socket.on("ping", this.onPing);
    this.socket.on("error", this.onError);
    // NOTE `on("message",` gets websocket frames while `onmessage` gets whole MessageEvents
    this.socket.onmessage = this.onMessage as (evt: any) => void;
  };

  private onOpen = () => {
    log.verbose("onOpen", this.url.host);
    this.heartbeat();
    this.onEvent({ action: "open" });
  };

  private onClose = (evt: CloseEvent) => {
    log.verbose("onClose", this.url.host, evt);
    this.onEvent({ action: "close", event: evt });
  };

  private onError = (error: ErrorEvent) => {
    log.error("onError", error.message);
    this.stop();
    if (error.message === HEARTBEAT_ERROR_MSG) {
      // always try reconnecting on heartbeat
      this.reconnectOnHeartbeatError();
    } else if (this.reconnectAttempts < this.maxReconnectAttempts) {
      // count non heartbeat reconnection attempts
      this.reconnectOnError();
    }
    this.onEvent({ action: "error", event: error });
  };

  private onPing = () => {
    this.heartbeat();
    log.verbose("onPing");
    this.onEvent({ action: "ping" });
  };

  private onMessage = (event: MessageEvent) => {
    const body = event.data.toString();
    // message received is an acknowledgement of a
    // message we have send, we can safely ignore this
    if (body.startsWith("ack:")) return;

    let message: string | undefined;
    try {
      message = decodeIncomingBody(body);
    } catch (error) {
      log.error(error);
    }
    if (message) {
      log.verbose("onmessage", this.url.host, message);
      this.onEvent({ action: "message", message });
    }
  };

  private stop = () => {
    clearTimeout(this.pingTimeout);
    clearTimeout(this.reconnectTimeout);
    this.socket.close();
  };

  /**
   * We want to close the connection,
   * and not reconnect again.
   */
  public close = () => {
    log.verbose("Closing regularly");
    this.stop();
  };

  /**
   * Send message through socket.
   * @param message - string
   */
  public send = (message: string) => {
    this.socket.send(message);
  };

  /**
   * Closes connection to the websocket server.
   * Makes `waitUntilSocketOpen` reject.
   * @param error
   */
  private closeWithError = (error: any) => {
    log.verbose("Closing with error", error);
    this.stop();
  };

  private heartbeat = () => {
    clearTimeout(this.pingTimeout);
    this.pingTimeout = setTimeout(() => {
      log.error(HEARTBEAT_ERROR_MSG);
      this.socket.emit("error", new Error(HEARTBEAT_ERROR_MSG));
    }, this.maxTimeWithoutPing);
  };

  private reconnectOnHeartbeatError = () => {
    log.normal(
      `WebSocket reconnect after heartbeat failure in ${this.reconnectDelay} ms`
    );
    this.reconnectTimeout = setTimeout(() => {
      this.initialize();
    }, this.reconnectDelay);
  };

  private reconnectOnError = () => {
    log.normal(
      `WebSocket reconnect after error. Attempting #${
        this.reconnectAttempts + 1
      } reconnect in ${this.reconnectDelay} ms`
    );
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.initialize();
    }, this.reconnectDelay);
  };
}
