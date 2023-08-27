export type RegisteredNode = {
  id: string;
  is_exit_node: boolean;
  chain_id: number;
  hoprd_api_endpoint: string;
  hoprd_api_token: string;
  exit_node_pub_key?: string;
  native_address: string;
  created_at: Date;
  updated_at: Date;
};
