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
import { createLogger } from "../utils";

const log = createLogger(["request-service"]);

/**
 * An abstraction layer for requests to interact with db.
 * @param db holds all methods to interact with db
 */
export class RequestService {
  constructor(private db: DBInstance) {}

  public async createRequest(params: {
    address: string;
    amount: string;
    chainId: number;
    accessTokenHash: string;
  }) {
    try {
      log.normal("Creating request...");
      const now = new Date(Date.now());
      const createRequest: CreateRequest = {
        amount: params.amount,
        accessTokenHash: params.accessTokenHash,
        nodeAddress: params.address,
        chainId: params.chainId,
        createdAt: now.toISOString(),
        requestId: Math.floor(Math.random() * 1e6),
        status: "FRESH",
      };
      await saveRequestDB(this.db, createRequest);
      return createRequest;
    } catch (e: any) {
      log.error("Failed to create request: ", e);
      throw new Error("request was not created");
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
      const request = { ...updateRequest, requestId } as UpdateRequest;
      await updateRequestDB(this.db, request);
      return updateRequest;
    } catch (e: any) {
      log.error(
        "Failed to update request",
        requestId,
        e,
        log.createMetric({ id: requestId })
      );
    }
  }

  public async deleteRequest(requestId: number) {
    log.normal(
      "Deleted request:",
      requestId,
      log.createMetric({ id: requestId })
    );
    return deleteRequestDB(this.db, requestId);
  }

  public async getOldestFreshRequest() {
    const requests = await this.getRequests();
    const freshRequests = requests?.filter((req) => req.status === "FRESH");
    const [oldestFreshRequest] = freshRequests?.sort(
      (a, b) =>
        new Date(a.createdAt).valueOf() - new Date(b.createdAt).valueOf()
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
      (request) => request.accessTokenHash === accessTokenHash
    );
    return [
      ...(successfulRequestsByAccessToken ?? []),
      ...(allUnresolvedRequestsByAccessToken ?? []),
    ];
  }

  public groupRequestsByChainId(requests: QueryRequest[]) {
    const requestsKeyedByChainId: { [chainId: number]: QueryRequest[] } = {};
    for (const request of requests ?? []) {
      requestsKeyedByChainId[request.chainId] = [
        ...(requestsKeyedByChainId[request.chainId] ?? []),
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
