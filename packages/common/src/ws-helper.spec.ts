import http from "http";
import WS from "isomorphic-ws";
import WebSocketHelper from "./ws-helper";
import * as fixtures from "./fixtures";

describe("test ws class", function () {
  const url = "ws://localhost:1234";
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
    jest.clearAllMocks();
  });

  it("gets a successful connection", (done) => {
    let connection: WebSocketHelper;
    const onMessageSpy = jest.fn((_data) => {
      // on message listener works
      connection.close();
      done();
    });

    server.on("connection", (ws) => {
      ws.on("message", () => {
        ws.send(fixtures.ENCODED_HOPRD_MESSAGE);
      });
    });

    connection = new WebSocketHelper(url, onMessageSpy);
    connection.waitUntilSocketOpen().then((conn) => {
      conn.send("i am connected");
    });
  });
  it("connection is lost and re-established", (done) => {
    const reconnectDelay = 10;
    const connection = new WebSocketHelper(url, () => {}, {
      reconnectDelay,
      attemptToReconnect: true,
    });

    // 1. wait for it to connect first time
    connection.waitUntilSocketOpen().then(() => {
      // 3. wait for reconnection logic to triger
      connection["socket"].on("error", () => {
        // 4. wait for successful connection
        connection.waitUntilSocketOpen().then(() => {
          expect(connection["reconnectAttempts"]).toEqual(1);
          connection.close();
          done();
        });
      });

      // 2. throw error and force it to reconnect
      connection["socket"].emit("error", new Error("test: force disconnect"));
    });
  });
  it("on error is emitted when ping is not received", (done) => {
    const connection = new WebSocketHelper(url, () => {}, {
      maxTimeWithoutPing: 1e3,
    });

    connection["socket"].on("error", (error) => {
      connection.close();
      expect(error.message).toContain("heartbeat");
      done();
    });
  });
  it("on error is not emitted when ping is received", (done) => {
    const maxTimeWithoutPing = 100;

    server.on("connection", (ws) => {
      const pingInterval = setInterval(() => {
        ws.ping();
      }, maxTimeWithoutPing / 4);

      ws.on("close", () => {
        clearInterval(pingInterval);
      });
    });

    const reconnectDelay = 100000;
    const waitUntilSocketOpenSpy = jest.spyOn(
      WebSocketHelper.prototype,
      "waitUntilSocketOpen"
    );
    let helper: WebSocketHelper;

    helper = new WebSocketHelper(url, () => {}, {
      reconnectDelay,
      maxTimeWithoutPing,
    });
    helper.waitUntilSocketOpen();

    // wait for 2 heartbeats
    setTimeout(() => {
      helper.close();
      expect(waitUntilSocketOpenSpy.mock.calls.length).toEqual(1);
      done();
    }, maxTimeWithoutPing * 2);
  });
  it("should throw on reconnect attempt", (done) => {
    server.close();
    httpServer.close();
    const connection = new WebSocketHelper(url, () => {}, {
      attemptToReconnect: false,
    });

    connection.waitUntilSocketOpen().catch((error) => {
      connection.close();
      expect(String(error)).toContain("WebSocket failed to connect");
      done();
    });
  });
  it("should throw when reaching all reconnect attempts", (done) => {
    server.close();
    httpServer.close();
    const connection = new WebSocketHelper(url, () => {}, {
      maxReconnectAttempts: 5,
    });

    connection.waitUntilSocketOpen().catch((error) => {
      connection.close();
      expect(String(error)).toContain("max attempts reached");
      expect(
        // @ts-ignore
        connection.reconnectAttempts
      ).toEqual(5);
      done();
    });
  });
});
