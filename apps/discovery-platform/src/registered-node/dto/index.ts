type RegisteredNode = {
  hasExitNode: boolean;
  peerId: string;
  chainId: number;
};

export type CreateRegisteredNode = RegisteredNode & {
  ports: {
    hoprApiEndpoint: string;
    hoprApiPort: number;
    exitNodePort: number;
  };
};

export type QueryRegisteredNode = RegisteredNode & {
  registeredAt: Date;
  totalAmountFunded: number;
  honestyScore: number;
  reason?: string;
  status: RegisteredNodeStatus;
  // should we have is exit node or can we use just has exit node?
};

type RegisteredNodeStatus = "FRESH" | "FUNDING" | "UNUSABLE" | "READY";
