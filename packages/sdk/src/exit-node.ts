import type { RawExitNode } from "./nodes-api";

export type ExitNode = {
  peerId: string;
  pubKey: string;
};

export function fromRaw({ exit_node_pub_key, id }: RawExitNode): ExitNode {
  return {
    peerId: id,
    pubKey: exit_node_pub_key,
  };
}
