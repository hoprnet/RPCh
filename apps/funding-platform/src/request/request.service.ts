import { DBInstance } from "../db";
import {
  getRequestsByAccessToken as getRequestsByAccessTokenDB,
  createRequest as createRequestDB,
  getRequest as getRequestDB,
  updateRequest as updateRequestDB,
  deleteRequest as deleteRequestDB,
} from "../db";
import { CreateRequest, UpdateRequest } from "./dto";

export class RequestService {
  constructor(private db: DBInstance) {}

  public async createRequest() {
    const createRequest = {} as CreateRequest;
    return createRequestDB(this.db, createRequest);
  }

  public async getRequestsByAccessToken(accessTokenHash: string) {
    return getRequestsByAccessTokenDB(this.db, accessTokenHash);
  }

  public async getRequestStatus(requestId: string) {
    return getRequestDB(this.db, requestId);
  }

  public async updateRequest() {
    const updateRequest = {} as UpdateRequest;
    return updateRequestDB(this.db, updateRequest);
  }

  public async deleteRequest(requestId: string) {
    return deleteRequestDB(this.db, requestId);
  }
}
