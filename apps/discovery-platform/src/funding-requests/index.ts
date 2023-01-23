import { createLogger } from "../utils";
import * as db from "../db";
import { CreateFundingRequest, QueryFundingRequest } from "./dto";
const log = createLogger(["registered-node"]);

/**
 * Saves a funding request in DB
 * @param dbInstance DBinstance
 * @param fundingRequest CreateFundingRequest
 * @returns boolean
 */
export const createFundingRequest = async (
  dbInstance: db.DBInstance,
  fundingRequest: CreateFundingRequest
): Promise<QueryFundingRequest> => {
  const newFundingRequest: Omit<
    QueryFundingRequest,
    "created_at" | "updated_at" | "id"
  > = {
    registered_node_id: fundingRequest.registeredNodeId,
    request_id: fundingRequest.requestId,
    amount: fundingRequest.amount,
  };

  log.verbose("saved new funding request", newFundingRequest);

  return await db.createFundingRequest(dbInstance, newFundingRequest);
};
