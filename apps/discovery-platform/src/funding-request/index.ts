import { createLogger } from "../utils";
import * as db from "../db";
import { FundingRequest, FundingRequestDB, DBInstance } from "../types";
const log = createLogger(["registered-node"]);

/**
 * Saves a funding request in DB
 * @param dbInstance DBinstance
 * @param fundingRequest FundingRequest
 * @returns boolean
 */
export const createFundingRequest = async (
  dbInstance: DBInstance,
  fundingRequest: FundingRequest
): Promise<FundingRequestDB> => {
  const newFundingRequest: Omit<
    FundingRequestDB,
    "created_at" | "updated_at" | "id"
  > = {
    registered_node_id: fundingRequest.registeredNodeId,
    request_id: fundingRequest.requestId,
    amount: fundingRequest.amount,
  };

  log.verbose("saved new funding request", newFundingRequest);

  return await db.createFundingRequest(dbInstance, newFundingRequest);
};
