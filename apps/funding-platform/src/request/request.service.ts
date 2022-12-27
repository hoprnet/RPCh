import { DBInstance } from "../db";
import * as db from "../db";
import { CreateRequest, QueryRequest, UpdateRequest } from "./dto";
import { utils } from "rpch-common";

const { log, logError } = utils.createLogger([
  "funding-platform",
  "request-service",
]);

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
   * @param amount string representing the amount that will be funded
   * @param chainId chain on which the transaction will execute
   * @param accessTokenHash hash that created this request
   * @returns Promise<QueryRequest>
   */
  public async createRequest(params: {
    nodeAddress: string;
    amount: string;
    chainId: number;
    accessTokenHash: string;
  }): Promise<QueryRequest> {
    try {
      log("Creating request...");
      const createRequest: CreateRequest = {
        amount: params.amount,
        accessTokenHash: params.accessTokenHash,
        nodeAddress: params.nodeAddress,
        chainId: params.chainId,
        status: "FRESH",
      };
      const dbRes = await db.saveRequest(this.db, createRequest);
      return dbRes;
    } catch (e: any) {
      logError("Failed to create request: ", e);
      throw new Error(e);
    }
  }

  /**
   * Gets all requests
   * @returns Promise<QueryRequest[]>
   */
  public async getRequests(): Promise<QueryRequest[]> {
    return db.getRequests(this.db);
  }

  /**
   * Returns all requests created by access token
   * @param accessTokenHash string
   * @returns Promise<QueryRequest[]>
   */
  public async getRequestsByAccessToken(
    accessTokenHash: string
  ): Promise<QueryRequest[]> {
    return db.getRequestsByAccessToken(this.db, accessTokenHash);
  }

  /**
   * Get request by id
   * @param requestId number
   * @returns Promise<QueryRequest>
   */
  public async getRequest(requestId: number): Promise<QueryRequest> {
    return db.getRequest(this.db, requestId);
  }

  /**
   * Updates request in DB and returns updated request
   * @param requestId number
   * @param updateRequest request object that will be saved, all properties will be overwritten
   * @returns Promise<QueryRequest>
   */
  public async updateRequest(
    requestId: number,
    updateRequest: UpdateRequest
  ): Promise<QueryRequest | undefined> {
    try {
      const request = { ...updateRequest, id: requestId } as UpdateRequest;
      const updatedRequest = await db.updateRequest(this.db, request);
      return updatedRequest;
    } catch (e: any) {
      logError("Failed to update request", requestId, e);
    }
  }

  /**
   * Deletes request with request id
   * @param requestId number
   * @returns Promise<QueryRequest>
   */
  public async deleteRequest(requestId: number): Promise<QueryRequest> {
    log("Deleted request:", requestId);
    return db.deleteRequest(this.db, requestId);
  }

  /**
   * Gets the oldest request with "FRESH" status
   */
  public async getOldestFreshRequest(): Promise<QueryRequest> {
    const oldestFreshRequest = await db.getOldestFreshRequest(this.db);
    return oldestFreshRequest;
  }

  /**
   * Queries all requests that have not been processed.
   * These are requests that have neither succeeded nor failed.
   */
  public async getAllUnresolvedRequests(): Promise<QueryRequest[]> {
    const unresolvedRequests = await db.getAllUnresolvedRequests(this.db);
    return unresolvedRequests;
  }

  /**
   * Queries all requests that are successful and that have not been processed.
   * Th requests that have not been processed t have neither succeeded nor failed.
   */
  public async getAllUnresolvedAndSuccessfulRequestsByAccessToken(
    accessTokenHash: string
  ): Promise<QueryRequest[]> {
    const allRequestsByAccessToken = await this.getRequestsByAccessToken(
      accessTokenHash
    );
    const successfulRequestsByAccessToken = allRequestsByAccessToken?.filter(
      (request) => request.status === "SUCCESS"
    );
    const allUnresolvedRequests = await this.getAllUnresolvedRequests();
    const allUnresolvedRequestsByAccessToken = allUnresolvedRequests?.filter(
      (request) => request.access_token_hash === accessTokenHash
    );
    return [
      ...(successfulRequestsByAccessToken ?? []),
      ...(allUnresolvedRequestsByAccessToken ?? []),
    ];
  }

  /**
   * Receives an array of requests and returns them in a key value object where the key is the chain
   * and the value is the array of requests
   * @param requests QueryRequest[]
   * @returns [chainId: number]: QueryRequest[]
   */
  public groupRequestsByChainId(requests: QueryRequest[]): {
    [chainId: number]: QueryRequest[];
  } {
    const requestsKeyedByChainId: { [chainId: number]: QueryRequest[] } = {};
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
   * @param requests QueryRequest[]
   * @returns [chainId: number]: number
   */
  public sumAmountOfRequests(requests: QueryRequest[]): {
    [chainId: number]: number;
  } {
    const requestsGroupedByChainId = this.groupRequestsByChainId(
      requests ?? []
    );
    {
      const sumOfRequestsByChainId: { [chainId: number]: number } = {};
      for (const chainId in requestsGroupedByChainId) {
        const sumOfRequests = requestsGroupedByChainId[chainId].reduce(
          (prev, next) => prev + Number(next.amount),
          0
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
      [chainId: number]: number;
    },
    frozenBalances: {
      [chainId: number]: number;
    }
  ): {
    [chainId: number]: number;
  } => {
    const availableBalances: { [chainId: number]: number } = {};
    for (const chainId in balances) {
      const totalBalance = Number(balances[chainId]);
      const frozenBalance = frozenBalances[Number(chainId)] ?? 0;
      const availableBalance = totalBalance - frozenBalance;
      availableBalances[Number(chainId)] = availableBalance;
    }
    return availableBalances;
  };
}
