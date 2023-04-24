import EventEmitter from "events";
import type { JsonRpc, EthereumProvider } from "ethereum-provider";

import SDK, { HoprSdkOps } from "@rpch/sdk";
import { createLogger, getResult, parseResponse } from "./utils";

const log = createLogger();

export class RPChEthereumProvider
  extends EventEmitter
  implements EthereumProvider
{
  sdk: SDK;
  _nextId: number = 1;

  constructor(
    private url: string,
    hoprSdkOps: HoprSdkOps,
    setKeyVal: (key: string, val: string) => Promise<any>,
    getKeyVal: (key: string) => Promise<string | undefined>
  ) {
    super();
    // initializes the RPCh SDK
    this.sdk = new SDK(hoprSdkOps, setKeyVal, getKeyVal);
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
    log.verbose("is sdk ready?", this.sdk.isReady);

    if (!this.sdk.isReady && !this.sdk.starting) {
      await this.sdk.start();
    }

    const payload = {
      method: request.method,
      params: request.params,
      id: this._nextId++,
      jsonrpc: "2.0",
    };

    const rpchRequest = await this.sdk.createRequest(
      this.url,
      JSON.stringify(payload)
    );

    log.verbose("Created request", rpchRequest.id);

    try {
      const rpchResponse = await this.sdk.sendRequest(rpchRequest);

      const response = getResult(
        parseResponse(rpchResponse)
      ) as JsonRpc.Response["result"];

      log.verbose("Received response for request", rpchRequest.id);

      return response;
    } catch (error) {
      log.error("Did not receive response for request", rpchRequest.id);
      throw error;
    }
  }
}
