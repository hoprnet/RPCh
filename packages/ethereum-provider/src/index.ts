import EventEmitter from "events";
import type { JsonRpc, EthereumProvider } from "ethereum-provider";

import RPChSDK from "@rpch/sdk";
import { createLogger, getResult } from "./utils";

const log = createLogger();

export class RPChEthereumProvider
  extends EventEmitter
  implements EthereumProvider
{
  _nextId: number = 1;

  constructor(private readonly sdk: RPChSDK) {
    super();
  }

  /**
   * Sends a request to the provider using the SDK instance.
   * This is async and response with the actual response and not the Response object
   * @param request - The JSON-RPC request payload to send.
   */
  public async request(request: {
    method: string;
    params?: Array<any>;
  }): Promise<unknown> {
    log.verbose("Using SEND", request.method);

    const payload = {
      method: request.method,
      params: request.params,
      id: this._nextId++,
      jsonrpc: "2.0" as const,
    };

    log.verbose("Created request");

    try {
      const rpchResponse = await this.sdk.send(payload);
      const response = getResult(rpchResponse) as JsonRpc.Response["result"];

      log.verbose("Received response for request");

      return response;
    } catch (error) {
      log.error("Did not receive response for request");
      throw error;
    }
  }
}
