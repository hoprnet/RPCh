import type { Server } from "http";
import levelup, { type LevelUp } from "levelup";
import leveldown from "leveldown";
import RPChSDK from "@rpch/sdk";
import * as server from "./server";
import { createLogger } from "./utils";
import {
  RESPONSE_TIMEOUT,
  CLIENT,
  DATA_DIR,
  DISCOVERY_PLATFORM_API_ENDPOINT,
  PORT,
} from "./constants";

const log = createLogger();

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
        client: this.client,
        timeout: this.timeout,
        discoveryPlatformApiEndpoint: this.discoveryPlatformApiEndpoint,
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

    log.normal("Starting rpc-server");
    const result = server.createServer(
      "0.0.0.0",
      Number(PORT),
      async (body, response, exitProvider) => {
        try {
          if (!this.sdk) throw Error("SDK not initialized");
          const rpcRequest = await this.sdk.createRequest(exitProvider, body);
          log.verbose(
            "Sending request",
            rpcRequest.id,
            rpcRequest.toMessage().body
          );
          const rpcResponse = await this.sdk.sendRequest(rpcRequest);
          log.verbose(
            "Received response",
            rpcRequest.id,
            rpcResponse.toMessage().body
          );
          response.write(rpcResponse.body);
          response.statusCode = 200;
          response.end();
        } catch (e: unknown) {
          response.statusCode = 400;
          if (e instanceof Error) {
            response.write(e.message);
          } else if (typeof e === "string") {
            response.write(e);
          }
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
