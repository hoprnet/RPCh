export enum Wallet {
  DUMMY_SMALL,
  DUMMY_MEDIUM,
  DUMMY_LARGE,
  REAL_COW_SWAP,
  REAL_METAMASK,
}

export type WalletTypes = keyof typeof Wallet;

export enum JsonRpcMethod {
  GET_BALANCE = "eth_getBalance",
  GET_BLOCKNUMBER = "eth_blockNumber",
  GET_TX_COUNT = "eth_getBlockTransactionCountByNumber",
  GET_CODE = "GET_CODE",
  CALL = "eth_call",
} 

export type JsonRpcMethodTypes = keyof typeof JsonRpcMethod;

/**
 *  A JSON-RPC payload, which are sent to a JSON-RPC server.
 */
export type JsonRpcPayload = {
  id: number;
  method: string;
  params: Array<any> | Record<string, any>;
  jsonrpc: "2.0";
};

export enum TestOption {
  SOAK,
  SMOKE,
  SPIKE,
  STRESS,
  LOAD,
  BURST,
  CONSTANT,
  LONG,
}

export type OptionTypes = keyof typeof TestOption;
