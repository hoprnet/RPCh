import http from "http";
import WS from "isomorphic-ws";
import HoprWebSocket from "./ws";
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
  });

  it("gets a successful connection", (done) => {
    let connection: HoprWebSocket;
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

    connection = new HoprWebSocket(url, onMessageSpy, 5000, 600e3);
    connection.setUpEventHandlers();
    connection.establishInfiniteWsConnection().then((conn) => {
      conn.send("i am connected");
    });
  });
  it("retries connection and event han", (done) => {
    const retryTimeout = 10;
    const onMessageSpy = jest.fn();
    let connection: HoprWebSocket;

    connection = new HoprWebSocket(url, onMessageSpy, retryTimeout, 60e3);
    connection.setUpEventHandlers();
    connection.establishInfiniteWsConnection().then(() => {
      connection.on("close", () => {});
      connection.emit("error");
      connection.close();
      done();
    });
  });

  it.skip("on error is emitted when ping is not received", (done) => {
    const onMessageSpy = jest.fn(() => {});
    server.on("connection", (ws) => {
      ws.send("connected");
      ws.on("message", () => {
        ws.send(fixtures.ENCODED_HOPRD_MESSAGE);
      });
    });
    new HoprWebSocket(url, onMessageSpy, 1000, 60e3)
      .establishInfiniteWsConnection()
      .then((connection) => {
        connection.send("i am connected");
        connection.on("error", () => {
          // on error is emitted when ping is not received
          done();
        });
        connection.close();
      });
  });
  it.skip("on error is not emitted when ping is received", (done) => {
    const onMessageSpy = jest.fn(() => {});
    server.on("connection", (ws) => {
      ws.send("connected");
      ws.send("ping");
      ws.on("message", () => {
        ws.send(fixtures.ENCODED_HOPRD_MESSAGE);
      });
    });
    new HoprWebSocket(url, onMessageSpy, 1000, 60e3)
      .establishInfiniteWsConnection()
      .then((connection) => {
        connection.send("i am connected");
        connection.on("error", () => {
          // on error is not emitted when ping is not received
          expect(false);
        });
        connection.on("ping", () => {
          // ping is received
          done();
        });
        connection.close();
      });
  });
});
