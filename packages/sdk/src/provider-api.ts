import * as JRPC from "./jrpc";

export function fetchChainId(provider: string): Promise<JRPC.Response> {
  const url = new URL(provider);
  const headers = { "Content-Type": "application/json" };
  const body = JSON.stringify(JRPC.chainId(provider));
  return fetch(url, { headers, method: "POST", body }).then(
    (r) => r.json() as unknown as JRPC.Response
  );
}

export function fetchRPC(
  provider: string,
  req: JRPC.Request,
  reqHeaders?: Record<string, string>
): Promise<JRPC.Response> {
  const url = new URL(provider);
  const headers = mergeHeaders(reqHeaders);
  const body = JSON.stringify(req);
  return fetch(url, { headers, method: "POST", body }).then(
    (r) => r.json() as unknown as JRPC.Response
  );
}

function mergeHeaders(headers?: Record<string, string>) {
  return {
    ...headers,
    "Content-Type": "application/json",
  };
}
