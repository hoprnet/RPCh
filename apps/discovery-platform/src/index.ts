import { DBInstance } from "./db";
import { entryServer } from "./entry-server";
import { FundingPlatformApi } from "./funding-platform-api";

const {
  // Port that server will listen for requests
  PORT = 3000,
  // Api endpoint used for completing funding requests of registered nodes
  FUNDING_PLATFORM_API,
  // Minimal amount of balance a account must have to show commitment
  BALANCE_THRESHOLD,
  // Minimal amount of open channels a account must have to show commitment
  CHANNELS_THRESHOLD,
  // Unit amount of quotas a request costs
  BASE_QUOTA = 1,
} = process.env;

const main = () => {
  if (!FUNDING_PLATFORM_API)
    throw new Error('Missing "FUNDING_PLATFORM_API" env variable');
  if (!BALANCE_THRESHOLD)
    throw new Error('Missing "BALANCE_THRESHOLD" env variable');
  if (!CHANNELS_THRESHOLD)
    throw new Error('Missing "CHANNELS_THRESHOLD" env variable');

  const db: DBInstance = {
    data: {
      registeredNodes: [],
      quotas: [],
    },
  };

  // init services
  const fundingPlatformApi = new FundingPlatformApi(FUNDING_PLATFORM_API, db);

  // listen for pending nodes with no funding

  // const requestFundsForReadyNodes = setTimeout(async () => {
  //   const nodes = await getRegisteredNodes(db);
  //   const readyNodesWithNoFunding = nodes.filter(
  //     (node) =>
  //       node.status === "READY" &&
  //       node.totalAmountFunded < Number(BALANCE_THRESHOLD)
  //   );
  //   for (const node of readyNodesWithNoFunding) {
  //     const isCommitted = await checkCommitment({
  //       minBalance: Number(BALANCE_THRESHOLD),
  //       minChannels: Number(CHANNELS_THRESHOLD),
  //       node,
  //     });
  //     if (isCommitted) {
  //       fundingPlatformApi.requestFunds(Number(BALANCE_THRESHOLD), node);
  //     }
  //   }
  // });

  // keep track of all pending funding requests to update status or retry

  // const checkForPendingRequests = setTimeout(async () => {
  //   await fundingPlatformApi.checkForPendingRequests();
  // }, 1000);

  const server = entryServer({
    db,
    baseQuota: Number(BASE_QUOTA),
    fundingPlatformApi,
  });
  server.listen(PORT);

  // return () => {
  //   clearInterval(checkForPendingRequests);
  //   clearInterval(requestFundsForReadyNodes);
  // };
};

main();
