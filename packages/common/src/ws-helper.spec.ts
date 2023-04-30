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

    connection = new WebSocketHelper(url, onMessageSpy, 5000, 600e3);
    connection.setUpEventHandlers();
    connection.waitUntilSocketOpen().then((conn) => {
      conn.send("i am connected");
    });
  });
  it("connection is lost and re established", (done) => {
    const retryTimeout = 10;
    const waitUntilSocketOpenSpy = jest.spyOn(
      WebSocketHelper.prototype,
      "waitUntilSocketOpen"
    );
    let helper: WebSocketHelper;

    helper = new WebSocketHelper(url, () => {}, retryTimeout, 60e3);
    helper.setUpEventHandlers();
    helper.socket.on("error", () => {
      // should have been called twice
      expect(waitUntilSocketOpenSpy.mock.calls.length).toEqual(2);
      helper.close();
      done();
    });
    helper.waitUntilSocketOpen().then(() => {
      helper.socket.emit("error", "error");
    });
  });
  it("on error is emitted when ping is not received", (done) => {
    const retryTimeout = 100000;
    const heartbeatTimeout = 1000;
    const waitUntilSocketOpenSpy = jest.spyOn(
      WebSocketHelper.prototype,
      "waitUntilSocketOpen"
    );
    let helper: WebSocketHelper;

    helper = new WebSocketHelper(url, () => {}, retryTimeout, heartbeatTimeout);
    helper.setUpEventHandlers();
    helper.waitUntilSocketOpen();
    helper.socket.on("error", () => {
      // should have been called twice because ping was not received
      expect(waitUntilSocketOpenSpy.mock.calls.length).toBeGreaterThan(1);
      helper.close();
      done();
    });
  });
  it("on error is not emitted when ping is received", (done) => {
    const heartbeatTimeout = 100;

    server.on("connection", (ws) => {
      const pingInterval = setInterval(() => {
        ws.ping();
      }, heartbeatTimeout / 4);

      ws.on("close", () => {
        clearInterval(pingInterval);
      });
    });

    const retryTimeout = 100000;
    const waitUntilSocketOpenSpy = jest.spyOn(
      WebSocketHelper.prototype,
      "waitUntilSocketOpen"
    );
    let helper: WebSocketHelper;

    helper = new WebSocketHelper(url, () => {}, retryTimeout, heartbeatTimeout);
    helper.setUpEventHandlers();
    helper.waitUntilSocketOpen();

    // wait for 2 heartbeats
    setTimeout(() => {
      expect(waitUntilSocketOpenSpy.mock.calls.length).toEqual(1);
      helper.close();
      done();
    }, heartbeatTimeout * 2);
  });
});
