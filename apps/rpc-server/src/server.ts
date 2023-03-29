/**
 * Listens for incoming traffic coming from external services (ex: Wallet).
 */
import http, { type ServerResponse } from "http";
import { parse as parseUrl } from "url";
import { createLogger } from "./utils";

const log = createLogger(["server"]);

/**
 * Creates the server which accepts RPC requests.
 * @param host - host to run server on
 * @param port - port to run server on
 * @param onRequest - called everytime a new RPC request is received
 * @returns http server
 */
export const createServer = (
  host: string,
  port: number,
  onRequest: (
    body: string,
    responseObj: ServerResponse,
    exitProvider: string,
    exitPeerId?: string
  ) => void
): {
  server: http.Server;
  stop: () => void;
} => {
  const server = http.createServer((req, res) => {
    req.on("data", (data) => {
      let exitProvider: string | undefined;

      // extract any given data provided by url parameters
      try {
        if (!req.url) throw Error("invalid url");
        const query = parseUrl(req.url).query || "";
        const searchParams = new URLSearchParams(query);
        exitProvider = searchParams.get("exit-provider") || undefined;
      } catch {}

      // if exit-provider is missing, return missing parameter
      if (!exitProvider) {
        log.verbose("request rejected, missing exit-provider");
        res.statusCode = 422;
        res.write("Missing parameter 'exit-provider'");
        res.end();
        return;
      }

      const body = data.toString();
      log.verbose("request received", body, exitProvider);
      onRequest(body, res, exitProvider);
    });
  });

  server.listen(port, host, undefined, () => {
    log.normal(`HORP rpc-server is listening on ${host}:${port}`);
  });

  return {
    server,
    stop: () => {
      log.normal("Closing rpc-server");
      server.close();
    },
  };
};
