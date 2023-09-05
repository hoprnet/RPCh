const { WebSocket } = require("isomorphic-ws");

const wsUrl = process.env.WS_URL;
const wsApiToken = process.env.WS_API_TOKEN;

if (!wsUrl) {
  throw new Error("WS_URL missing");
}

if (!wsApiToken) {
  throw new Error("WS_API_TOKEN missing");
}

const url = new URL("/api/v3/messages/websocket", wsUrl);
url.searchParams.set("apiToken", wsApiToken);
const socket = new WebSocket(url);
socket.on("open", () => console.log("wsOpen"));
socket.on("close", () => console.log("wsClose"));
socket.on("error", () => console.log("wsError"));
socket.onmessage = (msg) => console.log("onMsg", msg.data);
