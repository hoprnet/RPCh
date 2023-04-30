import { createLogger, decodeIncomingBody } from "./utils";
import { WebSocket } from "isomorphic-ws";
const log = createLogger(["websocket"]);

class HoprWebSocket extends WebSocket {
  public pingTimeout: NodeJS.Timeout | undefined;

  constructor(
    url: string,
    private onMessage: (data: string) => void,
    private retryTimeout: number,
    private maxTimeWithoutPing: number
  ) {
    super(url);
  }

  public async establishInfiniteWsConnection(): Promise<WebSocket> {
    // try to establish connection infinitely
    while (true) {
      try {
        // wait for socket to establish
        await new Promise<void>((resolve, reject) => {
          this.onopen = () => {
            log.normal("Listening for incoming messages from HOPRd", this.url);
            resolve();
          };
          this.onerror = (event) => {
            log.error("WebSocket error:", event);
            reject(event);
          };
        });
        return this;
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
    clearTimeout(this.pingTimeout);
    super.close();
  }

  private heartbeat() {
    clearTimeout(this.pingTimeout);
    this.pingTimeout = setTimeout(() => {
      log.error("did not receive heartbeat");
      this.emit("error");
    }, this.maxTimeWithoutPing);
  }

  public setUpEventHandlers() {
    this.onmessage = (event) => {
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

    this.on("error", async (event) => {
      log.error("WebSocket error:", event);
      // close existing ws
      this.terminate();
      // open new ws
      await this.establishInfiniteWsConnection();
      // set up event handlers again
      this.setUpEventHandlers();
      console.log("Established new ws after error");
    });

    this.on("open", () => {
      this.heartbeat();
    });

    this.on("ping", () => {
      this.heartbeat();
    });
  }
}

export default HoprWebSocket;
