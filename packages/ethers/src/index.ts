import { JsonRpcProvider } from "@ethersproject/providers";
import { deepCopy } from "@ethersproject/properties";
import SDK, { type HoprSdkTempOps } from "rpch-sdk";
import { parseResponse, getResult, createLogger } from "./utils";

const log = createLogger(["ethers"]);

export class RPChProvider extends JsonRpcProvider {
  public sdk: SDK;

  constructor(public readonly url: string, hoprSdkTempOps: HoprSdkTempOps) {
    super(url);
    this.sdk = new SDK(5000, hoprSdkTempOps);
    this.sdk.start().catch((error) => log.error(error));
  }

  public async send(method: string, params: Array<any>): Promise<any> {
    const payload = {
      method: method,
      params: params,
      id: this._nextId++,
      jsonrpc: "2.0",
    };

    this.emit("debug", {
      action: "request",
      request: deepCopy(payload),
      provider: this,
    });

    // We can expand this in the future to any call, but for now these
    // are the biggest wins and do not require any serializing parameters.
    const cache = ["eth_chainId", "eth_blockNumber"].indexOf(method) >= 0;
    if (cache && !!this._cache[method]) {
      return this._cache[method];
    }

    const rpchRequest = this.sdk.createRequest(
      this.url,
      JSON.stringify(payload)
    );
    log.verbose(
      "Created request",
      rpchRequest.id,
      log.createMetric({ id: rpchRequest.id })
    );

    try {
      const rpchResponsePromise = this.sdk.sendRequest(rpchRequest);

      // Cache the fetch, but clear it on the next event loop
      if (cache) {
        this._cache[method] = rpchResponsePromise;
        setTimeout(() => {
          // @ts-ignore-next-line
          this._cache[method] = null;
        }, 0);
      }

      const rpchResponse = await rpchResponsePromise;
      const response = getResult(parseResponse(rpchResponse));
      log.verbose(
        "Received response for request",
        rpchRequest.id,
        log.createMetric({ id: rpchRequest.id })
      );
      this.emit("debug", {
        action: "response",
        request: payload,
        response: response,
        provider: this,
      });

      return response;
    } catch (error) {
      log.error(
        "Did not receive response for request",
        rpchRequest.id,
        log.createMetric({ id: rpchRequest.id })
      );
      this.emit("debug", {
        action: "response",
        error: error,
        request: rpchRequest,
        provider: this,
      });

      throw error;
    }
  }
}
