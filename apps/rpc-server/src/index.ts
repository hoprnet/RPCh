import type { Server } from "http";
import * as path from "path";
import levelup, { type LevelUp } from "levelup";
import leveldown from "leveldown";
import RPChSDK from "@rpch/sdk";
import * as server from "./server";
import { createLogger } from "./utils";

const log = createLogger();

const {
  DATA_DIR = path.join(process.cwd(), "db"),
  PORT = 3003,
  RESPONSE_TIMEOUT: RESPONSE_TIMEOUT_STR = "10000",
  DISCOVERY_PLATFORM_API_ENDPOINT,
} = process.env;

export class RPCServer {
  private db: LevelUp;
  public sdk?: RPChSDK;
  public server?: Server;
  private stopServer?: () => void;

  constructor(
    private dataDir: string,
    private timeout: number,
    private discoveryPlatformApiEndpoint: string
  ) {
    log.verbose("Initializing DB at", this.dataDir);
    this.db = levelup(leveldown(this.dataDir));
  }

  public async start() {
    log.verbose("Initializing RPCh SDK", {
      timeout: this.timeout,
      discoveryPlatformApiEndpoint: this.discoveryPlatformApiEndpoint,
    });
    this.sdk = new RPChSDK(
      {
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
          const rpcResponse = await this.sdk.sendRequest(rpcRequest);
          response.write(rpcResponse.body);
          response.statusCode = 200;
          response.end();
        } catch {
          response.statusCode = 400;
          response.end();
        }
      }
    );
    this.server = result.server;
    this.stopServer = result.stop;
  }

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
  const RESPONSE_TIMEOUT = Number(RESPONSE_TIMEOUT_STR);
  if (isNaN(RESPONSE_TIMEOUT)) {
    throw Error("env variable 'RESPONSE_TIMEOUT' not a number");
  }

  if (!DISCOVERY_PLATFORM_API_ENDPOINT) {
    throw Error("env variable 'DISCOVERY_PLATFORM_API_ENDPOINT' is not set");
  }

  log.normal("Starting rpc-server");

  const rpcServer = new RPCServer(
    DATA_DIR,
    RESPONSE_TIMEOUT,
    DISCOVERY_PLATFORM_API_ENDPOINT
  );
  rpcServer.start().catch((error) => log.error(error));
}
