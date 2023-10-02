export type Pairing = {
  entryId: string;
  exitId: string;
  createdAt: Date;
};

export type EntryNode = {
  id: string;
  hoprdApiEndpoint: string;
  hoprdApiToken: string;
};

export type ExitNode = {
  id: string;
  pubKey: string;
};

type DBPairing = {
  entry_id: string;
  exit_id: string;
  created_at: Date;
};

type DBEntryNode = {
  id: string;
  hoprd_api_endpoint: string;
  hoprd_api_token: string;
};

type DBExitNode = {
  id: string;
  exit_node_pub_key: string;
};

type DBRegisteredNode = {
  id: string;
  is_exit_node: boolean;
  chain_id: number;
  hoprd_api_endpoint: string;
  hoprd_api_token: string;
  exit_node_pub_key?: string;
  native_address: string;
  created_at: Date;
  updated_at?: Date;
};
