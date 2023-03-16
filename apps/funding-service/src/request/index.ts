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
  public async getAllUnresolvedRequests(
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
   * Queries all requests that are successful and that have not been processed.
   * Th requests that have not been processed t have neither succeeded nor failed.
   */
  public async getAllUnresolvedAndSuccessfulRequestsByAccessToken(
    accessTokenHash?: string
  ): Promise<RequestDB[]> {
    const successfulRequestsByAccessToken = await this.getRequests({
      access_token_hash: accessTokenHash,
      status: "SUCCESS",
    });
    const allUnresolvedRequestsByAccessToken =
      await this.getAllUnresolvedRequests(accessTokenHash);

    return [
      ...successfulRequestsByAccessToken,
      ...allUnresolvedRequestsByAccessToken,
    ];
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

  /**
   * Receives an array of requests and returns the sum per chain
   * @param requests RequestDB[]
   * @returns [chainId: number]: number
   */
  public sumAmountOfRequests(requests: RequestDB[]): {
    [chainId: number]: bigint;
  } {
    const requestsGroupedByChainId = this.groupRequestsByChainId(requests);
    {
      const sumOfRequestsByChainId: { [chainId: number]: bigint } = {};
      for (const chainId in requestsGroupedByChainId) {
        const sumOfRequests = requestsGroupedByChainId[chainId].reduce(
          (prev, next) => BigInt(prev) + BigInt(next.amount),
          BigInt(0)
        );
        sumOfRequestsByChainId[chainId] = sumOfRequests;
      }
      return sumOfRequestsByChainId;
    }
  }

  /**
   * Receives balances and frozen balances and returns a key value pair of the available balances
   * @param balances object where the key is the chain and the value is the balance for that chain
   * @param frozenBalances object where the key is the chain and the value is the frozen balance for that chain
   * @returns [chainId: number]: number
   */
  public calculateAvailableFunds = (
    balances: {
      [chainId: number]: bigint;
    },
    frozenBalances: {
      [chainId: number]: bigint;
    }
  ): {
    [chainId: number]: bigint;
  } => {
    const availableBalances: { [chainId: number]: bigint } = {};
    for (const chainId in balances) {
      const totalBalance = balances[chainId];
      const frozenBalance = frozenBalances[Number(chainId)] ?? BigInt(0);
      const availableBalance = totalBalance - frozenBalance;
      availableBalances[Number(chainId)] = availableBalance;
    }
    return availableBalances;
  };
}
