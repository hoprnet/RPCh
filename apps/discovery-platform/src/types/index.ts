export * from "./client";
export * from "./funding-request";
export * from "./funding-service-api";
export * from "./graph-api";
export * from "./quota";
export * from "./registered-node";

export type AvailabilityMonitorResult = {
  connectivityReview: {
    outgoingChannels: {
      [outgoingChannelPeerId: string]: number;
    };
    exitNodesToOutgoingChannels: {
      [exitNodePeerId: string]: {
        [outgoingChannelPeerId: string]: number;
      };
    };
  };
  isStable: boolean;
  isStableAndHasOutgoingChannel: boolean;
  deliveryOdds: number;
};
