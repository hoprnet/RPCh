import { JsonRpcProvider } from "@ethersproject/providers";
import { deepCopy } from "@ethersproject/properties";
import SDK, { type HoprSdkOps } from "@rpch/sdk";
import { parseResponse, getResult, createLogger } from "./utils";

const log = createLogger();

/**
 * RPChProvider extends the JsonRpcProvider from ethers to enable use with Hopr protocol.
 * Internally, it uses the RPCh SDK to send and receive requests RPC requests.
 * @extends JsonRpcProvider
 */
export class RPChProvider extends JsonRpcProvider {
  public sdk: SDK;

  /**
   * @param hoprSdkOps - The options object for the SDK instance.
   * @param setKeyVal - Function that sets a key-value pair in storage.
   * @param getKeyVal - Function that retrieves the value corresponding to a key from storage.
   */
  constructor(
    public readonly url: string,
    hoprSdkOps: HoprSdkOps,
    setKeyVal: (key: string, val: string) => Promise<any>,
    getKeyVal: (key: string) => Promise<string | undefined>
  ) {
    super(url);
    // initializes the RPCh SDK
    this.sdk = new SDK(hoprSdkOps, setKeyVal, getKeyVal);
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
    log.verbose("is sdk ready?", this.sdk.isReady);

    if (!this.sdk.isReady && !this.sdk.starting) {
      await this.sdk.start();
    }

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

    const rpchRequest = await this.sdk.createRequest(
      this.url,
      JSON.stringify(payload)
    );
    log.verbose("Created request", rpchRequest.id);

    try {
      const rpchResponsePromise = this.sdk.sendRequest(rpchRequest);
      log.verbose("Send request", rpchRequest.id);

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
      log.verbose("Received response for request", rpchRequest.id);
      this.emit("debug", {
        action: "response",
        request: payload,
        response: response,
        provider: this,
      });

      return response;
    } catch (error) {
      log.error("Did not receive response for request", rpchRequest.id);
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
