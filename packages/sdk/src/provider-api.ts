import * as JRPC from "./jrpc";

export type RPCSuccess = JRPC.Response;
export type RPCFailure = { status: number; message: string };
export type RPCResp = RPCSuccess | RPCFailure;

export function fetchChainId(provider: string): Promise<JRPC.Response> {
  const url = new URL(provider);
  const headers = { "Content-Type": "application/json" };
  const body = JSON.stringify(JRPC.chainId(provider));
  return fetch(url, { headers, method: "POST", body }).then(async (res) => {
    if (res.status !== 200) {
      throw new Error(
        `Unexpected response: ${res.status}, ${await res.text()}`
      );
    }
    return res.json() as unknown as JRPC.Response;
  });
}

export function fetchRPC(
  provider: string,
  req: JRPC.Request,
  reqHeaders?: Record<string, string>
): Promise<RPCResp> {
  return new Promise((resolve, _reject) => {
    const url = new URL(provider);
    const headers = mergeHeaders(reqHeaders);
    const body = JSON.stringify(req);
    fetch(url, { headers, method: "POST", body }).then(async (res) => {
      if (res.status !== 200) {
        return resolve({ status: res.status, message: await res.text() });
      }
      const resp = (await res.json()) as unknown as JRPC.Response;
      return resolve(resp);
    });
  });
}

function mergeHeaders(headers?: Record<string, string>) {
  return {
    ...headers,
    "Content-Type": "application/json",
  };
}
