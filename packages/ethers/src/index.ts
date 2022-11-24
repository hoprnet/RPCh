import { JsonRpcProvider } from "@ethersproject/providers";
import { deepCopy } from "@ethersproject/properties";
import { fixtures } from "rpch-commons";
import SDK from "rpch-sdk";

const TIMEOUT = 10e3;
const DISCOVERY_PLATFORM_API_ENDPOINT = "http://discovery_platform";
const ENTRY_NODE_API_ENDPOINT = "http://entry_node";
const ENTRY_NODE_API_TOKEN = "12345";
const EXIT_NODE_PEER_ID = fixtures.PEER_ID_B;

export class RPChProvider extends JsonRpcProvider {
  public sdk: SDK;

  constructor(public readonly url: string, public readonly origin: string) {
    super(url);
    this.sdk = new SDK(
      TIMEOUT,
      DISCOVERY_PLATFORM_API_ENDPOINT,
      ENTRY_NODE_API_ENDPOINT,
      ENTRY_NODE_API_TOKEN,
      EXIT_NODE_PEER_ID
    );
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
      this.origin,
      this.url,
      JSON.stringify(payload)
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
      const response = rpchResponse.body;
      this.emit("debug", {
        action: "response",
        request: payload,
        response: response,
        provider: this,
      });

      return response;
    } catch (error) {
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
