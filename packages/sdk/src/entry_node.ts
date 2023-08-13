import type { RawEntryNode } from "./nodes-api";

export type EntryNode = {
  apiEndpoint: URL;
  accessToken: string;
  peerId: string;
  recommendedExits: Set<string>;
};

export function fromRaw({
  hoprd_api_endpoint,
  accessToken,
  id,
}: RawEntryNode): EntryNode {
  return {
    apiEndpoint: new URL(hoprd_api_endpoint),
    accessToken,
    peerId: id,
    recommendedExits: new Set(),
  };
}
