import { JsonRpcProvider } from "@ethersproject/providers";
import { deepCopy } from "@ethersproject/properties";
import SDK, { type HoprSdkOps } from "@rpch/sdk";
import { parseResponse, getResult, createLogger } from "./utils";
import EventEmitter from "events";
import type { JsonRpc } from "ethereum-provider";
import type { Callback, JsonRpcResponse } from "ethereum-provider/dist/types";

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
    log.verbose(
      "Created request",
      rpchRequest.id,
      log.createMetric({ id: rpchRequest.id })
    );

    try {
      const rpchResponsePromise = this.sdk.sendRequest(rpchRequest);
      log.verbose(
        "Send request",
        rpchRequest.id,
        log.createMetric({ id: rpchRequest.id })
      );

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

export class RPChEthereumProvider extends EventEmitter {
  public sdk: SDK;
  private _nextId: number = 1;
  private connected: boolean;
  private closed: boolean;
  private _emit: (event: string, payload?: any) => boolean | null;

  constructor(
    private url: string,
    hoprSdkOps: HoprSdkOps,
    setKeyVal: (key: string, val: string) => Promise<any>,
    getKeyVal: (key: string) => Promise<string | undefined>
  ) {
    super();
    // initializes the RPCh SDK
    this.sdk = new SDK(hoprSdkOps, setKeyVal, getKeyVal);
    this.sdk.debug.enable("rpch*");
    this.connected = false;
    this.closed = false;
    setTimeout(() => this.create(), 0);
    this._emit = (event, payload) =>
      !this.closed ? this.emit(event, payload) : null;
  }

  onError(err: Error) {
    if (!this.closed && this.listenerCount("error")) this.emit("error", err);
  }

  create() {
    this.on("error", () => {
      if (this.connected) this.close();
    });
    this.sdk.start().then(() => {
      this.init();
    });
  }

  init() {
    this.send(
      { method: "net_version", params: [], id: this._nextId++, jsonrpc: "2.0" },
      (err) => {
        console.log("RPCH " + "init " + err);
        if (err) return this.onError(err);
        this.connected = true;

        this._emit("connect");
      }
    );
  }

  pollSubscriptions() {
    log.error("subscriptions are not supported");
  }

  close() {
    this._emit("close");
    this.closed = true;
    this.sdk.stop();
    this.removeAllListeners();
  }

  filterStatus(res: { status: number; statusText: string | undefined }) {
    if (res.status >= 200 && res.status < 300) return res;
    const error = new Error(res.statusText);
    throw error.message;
  }

  error(payload: JsonRpc.Payload, message: string, code = -1) {
    this._emit("payload", {
      id: payload.id,
      jsonrpc: payload.jsonrpc,
      error: { message, code },
    });
  }

  handleRes(
    payload: JsonRpc.Payload,
    result?: JsonRpc.Response,
    callback?: Callback<JsonRpc.Response>,
    err?: Error
  ) {
    if (callback) {
      callback(err ?? null, result);
    } else {
      const { id, jsonrpc } = payload;
      const load = err
        ? { id, jsonrpc, error: { message: err.message } }
        : { id, jsonrpc, result };
      this._emit("payload", load);
    }
  }

  /**
   * This is identical to sendAsync. Historically, this used a synchronous web request,
   * but no current browsers support this, so its use this way was deprecated quite a long time ago
   * https://docs.ethers.org/v5/api/providers/other/#Web3Provider--ExternalProvider
   *
   * Sends a request to the provider using the SDK instance.
   * @param request - The JSON-RPC request payload to send.
   * @param callback - The callback function to be invoked upon completion.
   */
  public async send(
    payload: JsonRpc.Payload,
    callback: Callback<JsonRpc.Response>
  ) {
    if (!this.sdk.isReady) return;
    if (this.closed) return this.error(payload, "Not connected");

    this.sdk
      .createRequest(this.url, JSON.stringify(payload))
      .then((rpchRequest) => {
        console.log("here is the request", rpchRequest);
        log.verbose("Created request", rpchRequest.id);
        return this.sdk.sendRequest(rpchRequest);
      })
      .then((response) => {
        console.log("here is the response", response);
        log.verbose("Received response for request", payload.id);
        this.handleRes(payload, JSON.parse(response.body), callback);
      })
      .catch((error) => {
        console.log("here is the error", error);
        log.error("Did not receive response for request", payload.id);
        this.handleRes(payload, undefined, callback, error);
      });
  }

  /**
   * Sends a request to the provider using the SDK instance.
   * @param request - The JSON-RPC request payload to send.
   * @param callback - The callback function to be invoked upon completion.
   */
  public sendAsync(
    payload: JsonRpc.Payload,
    callback: Callback<JsonRpc.Response>
  ): any {
    if (!this.sdk.isReady) return;
    if (this.closed) return this.error(payload, "Not connected");
    this.sdk
      .createRequest(this.url, JSON.stringify(payload))
      .then((rpchRequest) => {
        log.verbose("Created request", rpchRequest.id);
        return this.sdk.sendRequest(rpchRequest);
      })
      .then((response) => {
        log.verbose("Received response for request", payload.id);
        this.handleRes(payload, JSON.parse(response.body), callback);
      })
      .catch((error) => {
        log.error("Did not receive response for request", payload.id);
        this.handleRes(payload, undefined, callback, error);
      });
  }

  /**
   * Sends a request to the provider using the SDK instance.
   * This is async and response with the actual response and not the Response object
   * @param request - The JSON-RPC request payload to send.
   */
  public async request(request: {
    method: string;
    params?: Array<any>;
  }): Promise<any> {
    log.verbose("Using SEND", request.method);
    log.verbose("is sdk ready?", this.sdk.isReady);

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
      const rpchResponsePromise = this.sdk.sendRequest(rpchRequest);
      log.verbose(
        "Send request",
        rpchRequest.id,
        log.createMetric({ id: rpchRequest.id })
      );

      const rpchResponse = await rpchResponsePromise;
      const response = getResult(parseResponse(rpchResponse));
      log.verbose(
        "Received response for request",
        rpchRequest.id,
        log.createMetric({ id: rpchRequest.id })
      );

      return response;
    } catch (error) {
      log.error(
        "Did not receive response for request",
        rpchRequest.id,
        log.createMetric({ id: rpchRequest.id })
      );
      throw error;
    }
  }
}
