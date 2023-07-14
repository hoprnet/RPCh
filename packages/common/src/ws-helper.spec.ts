import http from "http";
import WS from "isomorphic-ws";
import WebSocketHelper from "./ws-helper";
import type { onEventType } from "./ws-helper";

describe("test ws class", function () {
  const url = new URL("ws://localhost:1234");
  let server: WS.Server;
  let httpServer: http.Server;

  it("gets a successful connection", (done) => {
    httpServer = http.createServer();
    server = new WS.Server({ server: httpServer });
    httpServer.listen(1234);

    let connection: WebSocketHelper;
    let openHappened = false;
    const onEvent: onEventType = (evt) => {
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
          server.close();
          httpServer.close();
          done();
          break;
      }
    };
    connection = new WebSocketHelper(url, onEvent);
  });
});
