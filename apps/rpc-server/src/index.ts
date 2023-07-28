import http from "http";
import RPChSDK, {
  type RequestOps,
  RPCrequest,
  RPCresult,
  RPCerror,
} from "@rpch/sdk";
import * as RPChCrypto from "@rpch/crypto-for-nodejs";
import { utils } from "@rpch/common";

const log = utils.LoggerFactory("rpc-server")();

function toURL(urlStr: string): null | URL {
  // not all browsers support this
  if ("canParse" in URL) {
    // @ts-ignore
    if (URL.canParse(urlStr)) {
      return new URL(urlStr);
    }
    return null;
  }
  try {
    return new URL(urlStr);
  } catch (_err: any) /* TypeError */ {
    return null;
  }
}

function extractParams(urlStr: undefined | string): RequestOps {
  if (!urlStr) {
    return {};
  }
  const url = toURL(urlStr);
  if (!url) {
    return {};
  }
  const exitProvider = url.searchParams.get("exitProvider");
  const timeout = url.searchParams.get("timeout");
  const params: Record<string, string> = {};
  if (exitProvider != null) {
    params.exitProvider = exitProvider;
  }
  if (timeout != null) {
    params.timeout = timeout;
  }
  return params;
}

function parseBody(
  str: string
):
  | { success: false; error: string; id?: string }
  | { success: true; req: RPCrequest } {
  try {
    const json = JSON.parse(str);
    if (!("jsonrpc" in json)) {
      return {
        success: false,
        error: "'jsonrpc' property missing",
        id: json.id,
      };
    }
    if (!("method" in json)) {
      return {
        success: false,
        error: "'method' property missing",
        id: json.id,
      };
    }
    return { success: true, req: json };
  } catch (err: any) /* SyntaxError */ {
    return { success: false, error: "invalid JSON" };
  }
}

function sendRequest(
  sdk: RPChSDK,
  req: RPCrequest,
  params: RequestOps,
  res: http.ServerResponse
) {
  sdk
    .send(req, params)
    .then((resp: RPCresult | RPCerror) => {
      log.verbose("receiving response", resp);
      res.write(JSON.stringify(resp));
      res.statusCode = 200;
    })
    .catch((err: any) => {
      log.error("Error sending request", err);
      res.write({
        jsonrpc: req.jsonrpc,
        error: {
          code: -32603,
          message: `Internal JSON-RPC error: "${err}"`,
        },
        id: req.id,
      });
      res.statusCode = 500;
    })
    .finally(() => {
      res.end();
    });
}

function createServer(sdk: RPChSDK) {
  return http.createServer((req, res) => {
    req.on("error", (err) => {
      log.error("Unexpected error occured on http.Request", err);
    });

    res.on("error", (err) => {
      log.error("Unexpected error occured on http.Response", err);
    });

    req.on("data", async (data) => {
      const params = extractParams(req.url);
      const result = parseBody(data.toString);
      if (result.success) {
        log.verbose("sending request", result.req, "with params", params);
        sendRequest(sdk, result.req, params, res);
      } else {
        res.write({
          jsonrpc: "2.0",
          error: { code: -32700, message: "Parse error" },
          id: result.id,
        });
        res.statusCode = 500;
        res.end();
      }
    });
  });
}

/**
 * RPC server - uses RPChSDK to perform JSON-RPC requests.
 *
 * Reads ENV vars:
 *
 * CLIENT - client id, identifier of your wallet/application, required
 * RESPONSE_TIMEOUT - default request-response timeout, optional, can be overridden per request
 * EXIT_PROVDER - default rpc provider endpoint, optional, can be overridden per request
 * PORT - default port to run on, optional
 *
 * See **RPChSDK.RequestOps** for overridable per request parameters.
 */
if (require.main === module) {
  if (!process.env.CLIENT) {
    throw new Error("Missing 'CLIENT' env var.");
  }

  const clientId = process.env.CLIENT;

  const ops: Record<string, any> = {};
  if (process.env.DISCOVERY_PLATFORM_API_ENDPOINT) {
    ops.discoveryPlatformURL = process.env.DISCOVERY_PLATFORM_API_ENDPOINT;
  }
  if (process.env.RESPONSE_TIMEOUT) {
    ops.timeout = process.env.RESPONSE_TIMEOUT;
  }
  if (process.env.EXIT_PROVDER) {
    ops.provider = process.env.EXIT_PROVDER;
  }

  const portStr = process.env.PORT || "8080";
  const port = parseInt(portStr, 10);
  if (isNaN(port)) {
    throw new Error("Invalid 'PORT specified");
  }

  const sdk = new RPChSDK(clientId, RPChCrypto, ops);
  const server = createServer(sdk);
  server.listen(port, "0.0.0.0", () => {
    log.verbose(`rpc server started on '0.0.0.0:${port}'`);
  });
}
