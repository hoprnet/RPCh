import http from "http";
import WS from "isomorphic-ws";
import WebSocketHelper from "./ws-helper";
import type { onEventType } from "./ws-helper";

describe("test ws class", function () {
  const url = new URL("ws://localhost:1234");
  let server: WS.Server;
  let httpServer: http.Server;

  beforeEach(() => {
    httpServer = http.createServer();
    server = new WS.Server({ server: httpServer });
    httpServer.listen(1234);
  });

  afterEach(() => {
    server.close();
    httpServer.close();
  });

  it("gets a successful connection", (done) => {
    let connection: WebSocketHelper;
    const eventHist: string[] = [];
    const onEvent: onEventType = (evt) => {
      switch (evt.action) {
        // 1. open connection
        case "open":
          eventHist.push("open");
          connection.close();
          break;
        // 2. close connection
        case "close":
          eventHist.push("close");
          expect(eventHist).toEqual(["open", "close"]);
          done();
          break;
        default:
          eventHist.push(evt.action);
          break;
      }
    };
    connection = new WebSocketHelper(url, onEvent);
  });

  it("reconnects after losing connection", (done) => {
    const reconnectDelay = 10;
    let connection: WebSocketHelper;
    const eventHist: string[] = [];
    const onEvent: onEventType = (evt) => {
      switch (evt.action) {
        case "open":
          eventHist.push("open");
          // 1. wait for it to connect first time
          if (eventHist.length === 1) {
            // 2. throw error and force it to reconnect
            connection["socket"]!.emit(
              "error",
              new Error("test: force disconnect")
            );
          } else if (eventHist.length === 4) {
            // 4. close after reconnect
            connection.close();
          }

          break;
        case "close":
          // 3. handle close after error
          eventHist.push("close");
          if (eventHist.length > 3) {
            // 5. final close after reconnect
            expect(eventHist).toEqual([
              "open",
              "error",
              "close",
              "open",
              "close",
            ]);
            expect(connection["reconnectAttempts"]).toEqual(1);
            done();
          }
          break;
        default:
          eventHist.push(evt.action);
          break;
      }
    };
    connection = new WebSocketHelper(url, onEvent, {
      reconnectDelay,
      maxReconnectAttempts: 3,
    });
  });

  it("emits an error when ping is not received", (done) => {
    let connection: WebSocketHelper;
    const eventHist: string[] = [];
    const onEvent: onEventType = (evt) => {
      switch (evt.action) {
        case "error":
          eventHist.push("error");
          expect(evt.event.message).toContain("heartbeat");
          connection.close();
          break;
        case "close":
          eventHist.push("close");
          expect(eventHist).toEqual(["open", "error", "close"]);
          done();
          break;
        default:
          eventHist.push(evt.action);
          break;
      }
    };
    connection = new WebSocketHelper(url, onEvent, {
      maxTimeWithoutPing: 100,
    });
  });

  it("does not reconnect if instructed to", (done) => {
    server.close();
    httpServer.close();
    let connection: WebSocketHelper;
    const eventHist: string[] = [];
    const onEvent: onEventType = (evt) => {
      switch (evt.action) {
        case "close":
          eventHist.push("close");
          expect(eventHist).toEqual(["error", "close"]);
          connection.close();
          done();

        default:
          eventHist.push(evt.action);
          break;
      }
    };

    connection = new WebSocketHelper(url, onEvent, {
      maxReconnectAttempts: 0,
    });
  });
});
