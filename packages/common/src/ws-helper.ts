import { createLogger, decodeIncomingBody } from "./utils";
import { WebSocket } from "isomorphic-ws";
const log = createLogger(["websocket"]);

class WebSocketHelper {
  public pingTimeout: NodeJS.Timeout | undefined;
  public socket: WebSocket;
  private connectionIsClosing: boolean;

  constructor(
    private url: string,
    private onMessage: (data: string) => void,
    private retryTimeout: number,
    private maxTimeWithoutPing: number
  ) {
    this.socket = new WebSocket(url);
    this.connectionIsClosing = false;
  }

  public async waitUntilSocketOpen(): Promise<WebSocket> {
    // try to establish connection infinitely
    while (true) {
      try {
        // wait for socket to establish
        await new Promise<void>((resolve, reject) => {
          this.socket.onopen = () => {
            log.normal("Listening for incoming messages from HOPRd", this.url);
            resolve();
          };
          this.socket.onerror = (event) => {
            log.error("WebSocket error:", event);
            reject(event);
          };
        });
        return this.socket;
      } catch (error) {
        log.error(
          "WebSocket connection failed, retrying in %s ms...",
          this.retryTimeout,
          error
        );
        await new Promise<void>((resolve) =>
          setTimeout(resolve, this.retryTimeout)
        );
      }
    }
  }

  public close() {
    this.connectionIsClosing = true;
    clearTimeout(this.pingTimeout);
    this.socket.close();
  }

  private heartbeat() {
    clearTimeout(this.pingTimeout);
    this.pingTimeout = setTimeout(() => {
      log.error("did not receive heartbeat");
      this.socket.emit("error", "heartbeat was not received");
    }, this.maxTimeWithoutPing);
  }

  public setUpEventHandlers() {
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

    this.socket.on("error", async (event) => {
      log.error("WebSocket error:", event);
      // close existing ws
      if (this.connectionIsClosing) {
        log.error("Ws connection is still closing");
        return;
      }
      this.close();
      // open new ws
      this.socket = new WebSocket(this.url);
      await this.waitUntilSocketOpen();
      // set up event handlers again
      this.setUpEventHandlers();
      console.log("Established new ws after error");
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
