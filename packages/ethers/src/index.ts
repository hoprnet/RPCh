import { JsonRpcProvider } from "@ethersproject/providers";
import { deepCopy } from "@ethersproject/properties";
import SDK from "@rpch/sdk";
import { parseResponse, getResult, createLogger } from "./utils";

const log = createLogger();

/**
 * RPChProvider extends the JsonRpcProvider from ethers to enable use with Hopr protocol.
 * Internally, it uses the RPCh SDK to send and receive requests RPC requests.
 * @extends JsonRpcProvider
 */
export class RPChProvider extends JsonRpcProvider {
  /**
   * @param hoprSdkOps - The options object for the SDK instance.
   */
  constructor(public readonly url: string, public readonly sdk: SDK) {
    super(url);
  }

  /**
   * Sends a request to the provider using the SDK instance.
   * @param method - The RPC method to call.
   * @param params - The parameters to pass to the RPC method.
   * @returns A promise that resolves with the response from the server.
   * @throws An error if the request fails.
   */
  public async send(method: string, params: Array<any>): Promise<any> {
    log.verbose("Using SEND", method);

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

    try {
      const rpchResponsePromise = this.sdk.sendRequest(
        this.url,
        JSON.stringify(payload)
      );
      log.verbose("Send request");

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
      log.verbose("Received response for request");
      this.emit("debug", {
        action: "response",
        request: payload,
        response: response,
        provider: this,
      });

      return response;
    } catch (error) {
      log.error("Did not receive response for request");
      this.emit("debug", {
        action: "response",
        error: error,
        provider: this,
      });

      throw error;
    }
  }
}
