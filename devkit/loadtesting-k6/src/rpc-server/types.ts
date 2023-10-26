export enum Wallet {
  DUMMY,
  METAMASK_ON_COW_SWAP,
}

export type WalletTypes = keyof typeof Wallet;

export enum JsonRpcMethod {
  GET_BALANCE = "eth_getBalance",
  GET_BLOCKNUMBER = "eth_blockNumber",
  GET_BLOCK = "eth_getBlockByNumber",
  GET_TX_COUNT = "eth_getBlockTransactionCountByNumber",
  GET_CODE = "eth_getCode",
  NET_VERSION = "net_version",
  FEE_HISTORY = "eth_feeHistory",
  GAS_PRICE = "eth_gasPrice",
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
