export type Request = {
  readonly jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: any[] | object;
};

export type Response = Result | Error;

export type Result = {
  readonly jsonrpc: "2.0";
  id?: string | number | null;
  result: any;
};

export type Error = {
  readonly jsonrpc: "2.0";
  id?: string | number | null;
  error: {
    code: number;
    message: string;
    data?: any;
  };
};

export function chainId(id: string) {
  return {
    jsonrpc: "2.0",
    method: "eth_chainId",
    id,
    params: [],
  };
}

export function isError(r: Response): r is Error {
  return "error" in r;
}
