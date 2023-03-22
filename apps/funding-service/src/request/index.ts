import * as db from "../db";
import { Request, RequestDB, DBInstance, RequestFilters } from "../types";
import { DBTimestamp } from "../types/general";

import { createLogger } from "../utils";

const log = createLogger(["request-service"]);

/**
 * An abstraction layer for requests to interact with db.
 * @param db holds all methods to interact with db
 */
export class RequestService {
  /**
   * Creates Request Service
   * @param db Db instance where all data will be saved
   */
  constructor(private db: DBInstance) {}

  /**
   * Saves a Request in DB
   * @param nodeAddress node peer id
   * @param amount bigint amount that will be funded
   * @param chainId chain on which the transaction will execute
   * @param accessTokenHash hash that created this request
   * @returns Promise<RequestDB>
   */
  public async createRequest(params: {
    nodeAddress: string;
    amount: bigint;
    chainId: number;
    accessTokenHash: string;
  }): Promise<RequestDB> {
    try {
      log.normal("Creating request...");
      const createRequest: Request = {
        amount: params.amount,
        accessTokenHash: params.accessTokenHash,
        nodeAddress: params.nodeAddress,
        chainId: params.chainId,
        status: "FRESH",
      };
      const dbRes = await db.saveRequest(this.db, createRequest);
      log.verbose("Created request", createRequest);
      return dbRes;
    } catch (e: any) {
      log.error("Failed to create request: ", e);
      throw new Error(e);
    }
  }

  /**
   * Gets all requests
   * @returns Promise<RequestDB[]>
   */
  public async getRequests(where?: RequestFilters): Promise<RequestDB[]> {
    return db.getRequests(this.db, where);
  }

  /**
   * Returns sum of all requests created by access token
   * @param accessTokenHash string
   * @returns Promise<bigint>
   */
  public async getSumOfRequestsByAccessToken(
    accessTokenHash: string
  ): Promise<bigint> {
    return db.getSumOfRequestsByAccessToken(this.db, accessTokenHash);
  }

  /**
   * Get request by id
   * @param requestId number
   * @returns Promise<RequestDB>
   */
  public async getRequest(requestId: number): Promise<RequestDB> {
    return db.getRequest(this.db, requestId);
  }

  /**
   * Updates request in DB and returns updated request
   * @param requestId number
   * @param updateRequest request object that will be saved, all properties will be overwritten
   * @returns Promise<RequestDB>
   */
  public async updateRequest(
    requestId: number,
    updateRequest: Omit<RequestDB, keyof DBTimestamp>
  ): Promise<RequestDB> {
    try {
      const request: Omit<RequestDB, keyof DBTimestamp> = {
        ...updateRequest,
        id: requestId,
      };
      const updatedRequest = await db.updateRequest(this.db, request);
      return updatedRequest;
    } catch (e) {
      log.error("Failed to update request", requestId, e);
      throw e;
    }
  }

  /**
   * Deletes request with request id
   * @param requestId number
   * @returns Promise<RequestDB>
   */
  public async deleteRequest(requestId: number): Promise<RequestDB> {
    log.normal(
      "Deleted request:",
      requestId,
      log.createMetric({ id: requestId })
    );
    return db.deleteRequest(this.db, requestId);
  }

  /**
   * Gets the oldest request with "FRESH" status
   */
  public async getOldestFreshRequest(): Promise<RequestDB> {
    const oldestFreshRequest = await db.getOldestFreshRequest(this.db);
    return oldestFreshRequest;
  }

  /**
   * Queries all requests that have not been processed.
   * These are requests that have neither succeeded nor failed.
   */
  public async getUnresolvedRequests(
    accessTokenHash?: string
  ): Promise<RequestDB[]> {
    let queryOptions: { access_token_hash?: string } = {};

    // possible status a unresolved request can have
    let unresolvedStatuses: Request["status"][] = [
      "FRESH",
      "PROCESSING",
      "PENDING",
    ];

    // filter by accessTokenHash if param is sent
    if (accessTokenHash) {
      queryOptions["access_token_hash"] = accessTokenHash;
    }

    const unresolvedRequests = (
      await Promise.all(
        unresolvedStatuses.map((status) =>
          db.getRequests(this.db, {
            status,
            ...queryOptions,
          })
        )
      )
    ).flat();

    return unresolvedRequests;
  }

  /**
   *  Calculates the sum of requests by status from the database.
   * @param statuses An array of request statuses to filter by.
   *@param accessTokenHash (Optional) Access token hash to filter by.
   *@returns A promise that resolves to the sum of requests matching the given criteria.
   */
  public async getSumOfRequestsByStatus(
    statuses: RequestDB["status"][],
    accessTokenHash?: string
  ): Promise<bigint> {
    let queryOptions: { access_token_hash?: string } = {};
    // If accessTokenHash is provided, add it to the query options
    if (accessTokenHash) {
      queryOptions["access_token_hash"] = accessTokenHash;
    }

    // Get the sum of requests for each status in the given array
    const sums = await Promise.all(
      statuses.map((status) =>
        db.getSumOfRequests(this.db, {
          status,
          ...queryOptions,
        })
      )
    );

    // Reduce the sums array to calculate the total sum of requests by status
    const sumOfStatuses = sums.reduce((acc, next) => acc + next, BigInt(0));

    // Return the total sum of requests by status
    return sumOfStatuses;
  }

  /**
   * Queries all requests that are successful and that have not been processed.
   * Th requests that have not been processed t have neither succeeded nor failed.
   */
  public async getUnresolvedAndSuccessfulRequests(
    accessTokenHash?: string
  ): Promise<RequestDB[]> {
    let queryOptions: { access_token_hash?: string } = {};

    // filter by accessTokenHash if param is sent
    if (accessTokenHash) {
      queryOptions["access_token_hash"] = accessTokenHash;
    }

    const successfulRequests = await this.getRequests({
      status: "SUCCESS",
      ...queryOptions,
    });

    const allUnresolvedRequests = await this.getUnresolvedRequests(
      accessTokenHash
    );

    return [...successfulRequests, ...allUnresolvedRequests];
  }

  /**
   * Receives an array of requests and returns them in a key value object where the key is the chain
   * and the value is the array of requests
   * @param requests RequestDB[]
   * @returns [chainId: number]: RequestDB[]
   */
  public groupRequestsByChainId(requests: RequestDB[]): {
    [chainId: number]: RequestDB[];
  } {
    const requestsKeyedByChainId: { [chainId: number]: RequestDB[] } = {};
    for (const request of requests ?? []) {
      requestsKeyedByChainId[request.chain_id] = [
        ...(requestsKeyedByChainId[request.chain_id] ?? []),
        request,
      ];
    }
    return requestsKeyedByChainId;
  }
}
