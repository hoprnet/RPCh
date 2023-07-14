import http from "http";
import WS from "isomorphic-ws";
import WebSocketHelper from "./ws-helper";
import type { onEventType } from "./ws-helper";

describe("test ws class", function () {
  const url = new URL("ws://localhost:1234");
  let server: WS.Server;
  let httpServer: http.Server;

  beforeEach(function () {
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
    let openHappened = false;
    const onEvent: onEventType = (evt) => {
      console.log("event", evt.action, evt);
      switch (evt.action) {
        // 1. open connection
        case "open":
          openHappened = true;
          connection.close();
          break;
        case "message":
          done("unexpected message");
          break;
        case "error":
          done(`unexpected error: ${evt.event}`);
          break;
        // 2. close connection
        case "close":
          expect(openHappened).toBe(true);
          done();
          break;
      }
    };
    connection = new WebSocketHelper(url, onEvent);
  }, 100e3);

  it("emits an error when ping is not received", (done) => {
    let connection: WebSocketHelper;
    const onEvent: onEventType = (evt) => {
      switch (evt.action) {
        case "error":
          expect(evt.event.message).toContain("heartbeat");
          connection.close();
          done();
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
    let count = 0;
    const onEvent: onEventType = (evt) => {
      switch (evt.action) {
        case "error": {
          count++;
          break;
        }
      }
    };

    connection = new WebSocketHelper(url, onEvent, {
      maxReconnectAttempts: 0,
    });

    setTimeout(() => {
      connection.close();
      expect(count).toEqual(1);
      done();
    }, 1e3);
  });
});
