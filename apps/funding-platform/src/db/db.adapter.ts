import { CreateAccessToken, QueryAccessToken } from "access-token/dto";
import { DBInterface } from "./db.interface";

export class DBAdapter implements DBInterface {
  public constructor(private db: unknown) {}

  public saveAccessToken(accessToken: CreateAccessToken) {
    // db logic to save access token
  }
  public getAccessToken(accessToken: string) {
    return "" as unknown as QueryAccessToken;
  }
  public deleteAccessToken(accessToken: string) {}
  public createRequest(request: unknown) {}
  public getRequestsByToken(request: unknown) {}
  public updateRequest(request: unknown) {}
  public deleteRequest(request: unknown) {}
}
