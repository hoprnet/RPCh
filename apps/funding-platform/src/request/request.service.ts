import { DBInstance } from "../db";
import {
  getRequestsByAccessToken as getRequestsByAccessTokenDB,
  saveRequest as saveRequestDB,
  getRequest as getRequestDB,
  updateRequest as updateRequestDB,
  deleteRequest as deleteRequestDB,
  getRequests as getRequestsDB,
} from "../db";
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
  constructor(private db: DBInstance) {}

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
      const dbRes = await saveRequestDB(this.db, createRequest);
      return dbRes;
    } catch (e: any) {
      logError("Failed to create request: ", e);
      throw new Error(e);
    }
  }

  public async getRequests() {
    return getRequestsDB(this.db);
  }

  public async getRequestsByAccessToken(accessTokenHash: string) {
    return getRequestsByAccessTokenDB(this.db, accessTokenHash);
  }

  public async getRequest(requestId: number) {
    return getRequestDB(this.db, requestId);
  }

  public async updateRequest(requestId: number, updateRequest: UpdateRequest) {
    try {
      const request = { ...updateRequest, id: requestId } as UpdateRequest;
      await updateRequestDB(this.db, request);
      return updateRequest;
    } catch (e: any) {
      logError("Failed to update request", requestId, e);
    }
  }

  public async deleteRequest(requestId: number) {
    log("Deleted request:", requestId);
    return deleteRequestDB(this.db, requestId);
  }

  public async getOldestFreshRequest() {
    const requests = await this.getRequests();
    const freshRequests = requests?.filter((req) => req.status === "FRESH");
    const [oldestFreshRequest] = freshRequests?.sort(
      (a, b) =>
        new Date(a.created_at).valueOf() - new Date(b.created_at).valueOf()
    ) ?? [undefined];
    return oldestFreshRequest;
  }

  /**
   * Queries all requests that have not been processed.
   * These are requests that have neither succeeded nor failed.
   */
  public async getAllUnresolvedRequests() {
    const requests = await this.getRequests();
    const compromisedRequests = requests?.filter(
      (req) => req.status === "FRESH" || req.status === "PROCESSING"
    );
    return compromisedRequests;
  }

  public async getAllUnresolvedAndSuccessfulRequestsByAccessToken(
    accessTokenHash: string
  ) {
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

  public groupRequestsByChainId(requests: QueryRequest[]) {
    const requestsKeyedByChainId: { [chainId: number]: QueryRequest[] } = {};
    for (const request of requests ?? []) {
      requestsKeyedByChainId[request.chain_id] = [
        ...(requestsKeyedByChainId[request.chain_id] ?? []),
        request,
      ];
    }
    return requestsKeyedByChainId;
  }

  public sumAmountOfRequests(requests: QueryRequest[]) {
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

  public calculateAvailableFunds = (
    balances: {
      [chainId: number]: number;
    },
    frozenBalances: {
      [chainId: number]: number;
    }
  ) => {
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
