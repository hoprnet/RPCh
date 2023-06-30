import type { Server } from "http";
import levelup, { type LevelUp } from "levelup";
import leveldown from "leveldown";
import RPChSDK, { type EntryNode, type ExitNode } from "@rpch/sdk";
import * as RPChCrypto from "@rpch/crypto-for-nodejs";
import * as server from "./server";
import { createLogger } from "./utils";
import {
  RESPONSE_TIMEOUT,
  CLIENT,
  DATA_DIR,
  DISCOVERY_PLATFORM_API_ENDPOINT,
  PORT,
  FORCE_ENTRY_NODE_API_ENDPOINT,
  FORCE_ENTRY_NODE_API_TOKEN,
  FORCE_ENTRY_NODE_PEERID,
  FORCE_EXIT_NODE_PEERID,
  FORCE_EXIT_NODE_PUBKEY,
} from "./constants";

const log = createLogger();

// if all needed options have been passed, declare forceEntryNode
const forceEntryNode: EntryNode | undefined =
  FORCE_ENTRY_NODE_API_ENDPOINT &&
  FORCE_ENTRY_NODE_API_TOKEN &&
  FORCE_ENTRY_NODE_PEERID
    ? {
        apiEndpoint: FORCE_ENTRY_NODE_API_ENDPOINT,
        apiToken: FORCE_ENTRY_NODE_API_TOKEN,
        peerId: FORCE_ENTRY_NODE_PEERID,
      }
    : undefined;

// if all needed options have been passed, declare forceExitNode
const forceExitNode: ExitNode | undefined =
  FORCE_EXIT_NODE_PEERID && FORCE_EXIT_NODE_PUBKEY
    ? {
        peerId: FORCE_EXIT_NODE_PEERID,
        pubKey: FORCE_EXIT_NODE_PUBKEY,
      }
    : undefined;

/**
 * A class that represents an RPC server.
 * @class
 */
export class RPCServer {
  private db: LevelUp;
  public sdk?: RPChSDK;
  public server?: Server;
  private stopServer?: () => void;

  /**
   * Creates an instance of RPCServer.
   * @constructor
   * @param dataDir - The data directory.
   * @param timeout - The response timeout in milliseconds.
   * @param discoveryPlatformApiEndpoint - The API endpoint of the discovery platform.
   * @param client - The client ID.
   */
  constructor(
    private dataDir: string,
    private timeout: number,
    private discoveryPlatformApiEndpoint: string,
    private client: string
  ) {
    log.verbose("Initializing DB at", this.dataDir);
    this.db = levelup(leveldown(this.dataDir));
  }

  /**
   * Starts the RPC server.
   * @async
   */
  public async start() {
    log.verbose("Initializing RPCh SDK", {
      timeout: this.timeout,
      discoveryPlatformApiEndpoint: this.discoveryPlatformApiEndpoint,
    });
    this.sdk = new RPChSDK(
      {
        crypto: RPChCrypto,
        client: this.client,
        timeout: this.timeout,
        discoveryPlatformApiEndpoint: this.discoveryPlatformApiEndpoint,
        forceEntryNode,
        forceExitNode,
      },
      async (clientId, counter) => {
        await this.db.put(clientId, counter);
      },
      async (clientId) => {
        try {
          const val = await this.db.get(clientId);
          return val.toString();
        } catch {
          return "0";
        }
      }
    );
    await this.sdk.start();
    await this.sdk.waitForReliableNode(1e3);

    log.normal("Starting rpc-server");
    const result = server.createServer(
      "0.0.0.0",
      Number(PORT),
      async (body, response, exitProvider) => {
        let verboseLogs: string[] = [];
        try {
          if (!this.sdk) throw Error("SDK not initialized");
          const rpcRequest = await this.sdk.createRequest(exitProvider, body);
          const rpcRequestBody = rpcRequest.toMessage().body;
          log.verbose("Sending request %i %s", rpcRequest.id, rpcRequestBody);
          verboseLogs.push(
            `1/3: created request: "${rpcRequest.id}" with body "${rpcRequestBody}"`
          );
          const rpcResponse = await this.sdk.sendRequest(rpcRequest);
          const rpcResponseBody = rpcResponse.toMessage().body;
          verboseLogs.push(`2/3: send request: "${rpcRequest.id}"`);
          log.verbose("Received response", rpcRequest.id, rpcResponseBody);
          verboseLogs.push(
            `3/3: received response "${rpcResponse.id}" with body "${rpcResponseBody}" for request: "${rpcRequest.id}"`
          );
          // response has already ended
          if (!response.writable) {
            log.verbose(
              "Cannot respond while the response obj has already ended"
            );
            return;
          }
          response.write(rpcResponse.body);
          response.statusCode = 200;
          response.end();
        } catch (error: unknown) {
          const errorMsg = [
            "Error sending request",
            error instanceof Error ? error.message : error,
            verboseLogs.length === 0
              ? ""
              : `with trace ${verboseLogs.join(" -> ")}`,
          ].join(" ");
          log.error(errorMsg);
          // response has already ended
          if (!response.writable) {
            log.verbose(
              "Cannot respond while the response obj has already ended"
            );
            return;
          }
          response.write(
            JSON.stringify({
              jsonrpc: "2.0",
              error: { code: -32600, message: `Internal Error: "${errorMsg}"` },
              id: null,
            })
          );
          response.statusCode = 500;
          response.end();
        }
      }
    );
    this.server = result.server;
    this.stopServer = result.stop;
  }

  /**
   * Stops the RPC server.
   * @async
   */
  public async stop() {
    if (this.sdk) {
      await this.sdk.stop();
    }
    if (this.stopServer) {
      this.stopServer();
    }
  }
}

// if this file is the entrypoint of the nodejs process
if (require.main === module) {
  if (isNaN(RESPONSE_TIMEOUT)) {
    throw Error("env variable 'RESPONSE_TIMEOUT' not a number");
  }

  if (!DISCOVERY_PLATFORM_API_ENDPOINT) {
    throw Error("env variable 'DISCOVERY_PLATFORM_API_ENDPOINT' is not set");
  }

  if (!CLIENT) {
    throw Error("env variable 'CLIENT' is not set");
  }

  log.normal("Starting rpc-server");

  const rpcServer = new RPCServer(
    DATA_DIR,
    RESPONSE_TIMEOUT,
    DISCOVERY_PLATFORM_API_ENDPOINT,
    CLIENT
  );
  rpcServer.start().catch((error) => log.error(error));
}
