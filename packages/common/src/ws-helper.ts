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
  private listenOpen: () => void;
  private listenClose: (evt: CloseEvent) => void;
  private listenError: (evt: ErrorEvent) => void;
  private listenPing: () => void;
  private listenMessage: (evt: MessageEvent) => void;

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

    // create listeners
    this.listenOpen = () => {
      log.verbose("onOpen", this.url.host);
      this.heartbeat();
      this.onEvent({ action: "open" });
    };

    this.listenClose = (evt: CloseEvent) => {
      log.verbose("onClose", this.url.host, evt);
      this.onEvent({ action: "close", event: evt });
      // remove callback
      this.onEvent = function () {};
    };

    this.listenError = (error: ErrorEvent): void => {
      log.error("onError", error.message);
      this.stop();
      if (error.message === HEARTBEAT_ERROR_MSG) {
        // always try reconnecting on heartbeat
        setTimeout(() => this.reconnectOnHeartbeatError());
      } else if (this.reconnectAttempts < this.maxReconnectAttempts) {
        // count non heartbeat reconnection attempts
        setTimeout(() => this.reconnectOnError());
      }
      this.onEvent({ action: "error", event: error });
    };

    this.listenPing = () => {
      this.heartbeat();
      log.verbose("onPing");
      this.onEvent({ action: "ping" });
    };

    this.listenMessage = (event) => {
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

    this.initialize();
  }

  /**
   * We want to close the connection,
   * and not reconnect again.
   */
  public close() {
    log.verbose("Closing regularly");
    this.stop();
  }

  /**
   * Send message through socket.
   * @param message - string
   */
  public send(message: string) {
    this.socket.send(message);
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
      this.socket.emit("error", new Error(HEARTBEAT_ERROR_MSG));
    }, this.maxTimeWithoutPing);
  }

  private initialize() {
    this.socket = new WebSocket(this.url);

    // fired when connection established
    this.socket.on("open", this.listenOpen);

    // fired on incoming message
    // NOTE `on("message",` gets websocket frames while `onmessage` gets whole MessageEvents
    this.socket.onmessage = this.listenMessage as (evt: any) => void;

    // fired when connection closed due to error
    this.socket.on("error", this.listenError);

    this.socket.on("close", this.listenClose);

    this.socket.on("ping", this.listenPing);
  }

  private stop() {
    clearTimeout(this.pingTimeout);
    clearTimeout(this.reconnectTimeout);
    this.socket.removeEventListener("open", this.listenOpen);
    this.socket.onmessage = null;
    this.socket.removeEventListener(
      "error",
      this.listenError as (evt: any) => void
    );
    this.socket.removeEventListener(
      "close",
      this.listenClose as (evt: any) => void
    );

    // this.socket.removeEventListener("ping", this.listenPing as (evt: any) => void);

    this.socket.close();
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
