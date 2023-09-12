import * as Jrpc from "./jrpc";

export function fetchChainId(provider: string): Promise<Jrpc.Response> {
  const url = new URL(provider);
  const headers = { "Content-Type": "application/json" };
  const body = JSON.stringify(Jrpc.chainId(provider));
  return fetch(url, { headers, method: "POST", body }).then(
    (r) => r.json() as unknown as Jrpc.Response
  );
}
