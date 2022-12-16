import fetch from "node-fetch";
import {
  getAccessTokenResponse,
  getRequestStatusResponse,
  postFundingRequest,
  postFundingResponse,
} from "./dto";
import { isExpired } from "../utils";
import { QueryRegisteredNode } from "../registered-node/dto";
import { DBInstance } from "../db";
import { getRegisteredNode, updateRegisteredNode } from "../registered-node";
export class FundingPlatformApi {
  private accessToken: string | undefined;
  private expiredAt: Date | undefined;
  private amountLeft: number | undefined;
  private pendingRequests: Map<
    //peerId
    string,
    { amountOfRetries: number; requestId: number }
  > = new Map();

  constructor(private url: string, private db: DBInstance) {}

  private saveAccessToken(ops: getAccessTokenResponse): void {
    (this.accessToken = ops.accessToken),
      (this.expiredAt = new Date(ops.expiredAt));
    this.amountLeft = ops.amountLeft;
  }

  private async getAccessToken(amount?: number): Promise<string> {
    if (!this.accessTokenIsValid(amount)) {
      const res = await fetch(`${this.url}/api/access-token`);
      const resJson = (await res.json()) as getAccessTokenResponse;
      this.saveAccessToken(resJson);
      return this.accessToken!;
    } else {
      return this.accessToken!;
    }
  }

  private accessTokenIsValid(amount?: number): boolean {
    if (!this.accessToken || !this.amountLeft || !this.expiredAt) {
      return false;
    }
    if (isExpired(this.expiredAt.toISOString())) {
      return false;
    }
    if (amount && this.amountLeft < amount) {
      return false;
    }
    return true;
  }

  public async requestFunds(
    amount: number,
    node: QueryRegisteredNode,
    prevRetries?: number
  ) {
    if (!this.accessTokenIsValid(amount)) {
      await this.getAccessToken();
    }

    try {
      const res = await fetch(`${this.url}/api/request/funds/${node.peerId}`, {
        method: "POST",
        headers: {
          "x-access-token": this.accessToken!,
        },
        body: JSON.stringify({
          amount: String(amount),
          chainId: node.chainId,
        } as postFundingRequest),
      });
      await updateRegisteredNode(this.db, { ...node, status: "FUNDING" });

      const { id: requestId, amountLeft } =
        (await res.json()) as postFundingResponse;

      this.amountLeft = amountLeft;
      this.savePendingRequest(node.peerId, requestId, prevRetries ?? 0);
      return requestId;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  private async getRequestStatus(requestId: string) {
    if (!this.accessTokenIsValid()) {
      await this.getAccessToken();
    }

    const res = await fetch(`${this.url}/api/request/status/${requestId}`, {
      headers: {
        "x-access-token": this.accessToken!,
      },
    });

    const resJson = (await res.json()) as getRequestStatusResponse;

    return resJson;
  }

  private savePendingRequest(
    peerId: string,
    requestId: number,
    amountOfRetries: number
  ) {
    this.pendingRequests.set(peerId, {
      amountOfRetries: amountOfRetries,
      requestId: requestId,
    });
  }

  public async checkForPendingRequests() {
    for (const [
      peerId,
      { amountOfRetries, requestId },
    ] of this.pendingRequests.entries()) {
      const request = await this.getRequestStatus(String(requestId));
      const node = await getRegisteredNode(this.db, peerId);

      if (!node) throw new Error("Registered node does not exist");

      if (
        request.status === "SUCCESS" ||
        request.status === "REJECTED-DURING-PROCESSING"
      ) {
        await updateRegisteredNode(this.db, { ...node!, status: "READY" });
        this.pendingRequests.delete(peerId);
      } else if (
        request.status === "FAILED" ||
        request.status === "FAILED-DURING-PROCESSING"
      ) {
        const requestId = await this.requestFunds(
          Number(request.amount),
          node!
        );
        this.savePendingRequest(node.peerId, requestId, amountOfRetries + 1);
      }
    }
  }
}
