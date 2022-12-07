import { DBInstance } from "../db";
import {
  getRequestsByAccessToken as getRequestsByAccessTokenDB,
  saveRequest as saveRequestDB,
  getRequest as getRequestDB,
  updateRequest as updateRequestDB,
  deleteRequest as deleteRequestDB,
  getRequests as getRequestsDB,
} from "../db";
import { CreateRequest, UpdateRequest } from "./dto";

export class RequestService {
  constructor(private db: DBInstance) {}

  public async createRequest(params: {
    address: string;
    amount: string;
    chainId: number;
    accessTokenHash: string;
  }) {
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
    const request = { ...updateRequest, requestId } as UpdateRequest;
    await updateRequestDB(this.db, request);
    return updateRequest;
  }

  public async deleteRequest(requestId: number) {
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
}
