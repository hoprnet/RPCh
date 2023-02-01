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
import { createLogger } from "../utils";
import { createFundingRequest } from "../funding-requests";

const log = createLogger(["funding-service-api"]);

/**
 * API used to fund registered nodes, handles creating and keeping track of pending requests.
 */
export class FundingServiceApi {
  // Access token used to authenticate with funding service
  private accessToken: string | undefined;
  // Date when the current tokens expires
  private expiredAt: Date | undefined;
  // Maximum amount that the current token can request
  private amountLeft: bigint | undefined;
  // Map of all pending requests
  private pendingRequests: Map<
    //peerId
    string,
    { amountOfRetries: number; requestId: number }
  > = new Map();

  constructor(private url: string, private db: DBInstance) {}

  /**
   * Save new access token to instance
   * @param ops
   */
  private saveAccessToken(ops: getAccessTokenResponse): void {
    (this.accessToken = ops.accessToken),
      (this.expiredAt = new Date(ops.expiredAt));
    this.amountLeft = ops.amountLeft;
  }
  /**
   * Fetch from funding service a new access token
   * @returns string
   */
  private async fetchAccessToken(): Promise<string> {
    const res = await fetch(`${this.url}/api/access-token`);
    const resJson: getAccessTokenResponse = await res.json();
    log.verbose("Fetched access token", resJson);
    this.saveAccessToken(resJson);
    return resJson.accessToken;
  }

  /**
   * get a valid access token
   * @param amount
   * @returns string
   */
  private async getAccessToken(amount?: bigint): Promise<string> {
    if (!this.accessTokenIsValid(amount)) {
      const accessToken = this.fetchAccessToken();
      return accessToken;
    } else {
      return this.accessToken!;
    }
  }

  /**
   * check if current access token is valid
   * @param amount
   * @returns boolean
   */
  private accessTokenIsValid(amount?: bigint): boolean {
    if (!this.accessToken || !this.amountLeft || !this.expiredAt) {
      log.verbose("Access token for discovery platform does not exist");
      return false;
    }
    if (isExpired(this.expiredAt.toISOString())) {
      log.verbose(
        "Access token for discovery platform has expired",
        this.accessToken,
        this.expiredAt
      );

      return false;
    }
    if (amount && this.amountLeft < amount) {
      log.verbose(
        "Access token for discovery platform has exceeded how many amount that it can reclaim"
      );
      return false;
    }
    return true;
  }

  /**
   * Create a new funding request in funding service
   * @param amount amount that should be funded to the node
   * @param node registered node that is going to receive the funding
   * @param prevRetries bigint of times funding request has failed
   * @returns
   */
  public async requestFunds(
    amount: bigint,
    node: QueryRegisteredNode,
    prevRetries?: number
  ) {
    if (!this.accessTokenIsValid(amount)) {
      await this.getAccessToken();
    }

    try {
      const dbNode = await getRegisteredNode(this.db, node.id);
      if (!dbNode) throw new Error("Node is not registered");
      log.verbose("requesting from funding service", {
        amount: String(amount),
        chainId: node.chain_id,
      });

      const body: postFundingRequest = {
        amount: String(amount),
        chainId: node.chain_id,
      };
      const res = await fetch(
        `${this.url}/api/request/funds/${dbNode.native_address}`,
        {
          method: "POST",
          headers: {
            "x-access-token": this.accessToken!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      let fundingResponseJson = await res.json();
      log.verbose("funding service response", fundingResponseJson);
      await updateRegisteredNode(this.db, { ...dbNode, status: "FUNDING" });

      const { id: requestId, amountLeft }: postFundingResponse =
        fundingResponseJson;

      // save funding request in db
      await createFundingRequest(this.db, {
        registeredNodeId: dbNode.id,
        requestId,
        amount: String(amount),
      });

      this.amountLeft = amountLeft;
      this.savePendingRequest(node.id, requestId, prevRetries ?? 0);
      return requestId;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  /**
   * Get available funds from funding service
   */
  public async getAvailableFunds() {
    if (!this.accessTokenIsValid()) {
      await this.getAccessToken();
    }

    const funds = await fetch(`${this.url}/api/funds`, {
      headers: {
        "x-access-token": this.accessToken!,
      },
    });

    const fundsJSON = await funds.json();

    return fundsJSON;
  }

  /**
   * Get request status from funding service
   * @param requestId
   */
  private async getRequestStatus(requestId: string) {
    if (!this.accessTokenIsValid()) {
      await this.getAccessToken();
    }

    const res = await fetch(`${this.url}/api/request/status/${requestId}`, {
      headers: {
        "x-access-token": this.accessToken!,
      },
    });

    const resJson: getRequestStatusResponse = await res.json();

    return resJson;
  }

  /**
   * Save new request to pending requests so we can track it
   */
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

  /**
   * Goes through all pending requests and chooses to prune/retry/ignore
   */
  public async checkForPendingRequests() {
    log.verbose("amount of pending requests", this.pendingRequests.size);
    for (const [
      peerId,
      { amountOfRetries, requestId },
    ] of this.pendingRequests.entries()) {
      log.verbose("handling pending request", requestId);
      const request = await this.getRequestStatus(String(requestId));
      const node = await getRegisteredNode(this.db, peerId);

      if (!node) throw new Error("Registered node does not exist");

      // checks if it should prune
      if (
        request.status === "SUCCESS" ||
        request.status === "REJECTED-DURING-PROCESSING"
      ) {
        log.verbose("request for node", node);
        await updateRegisteredNode(this.db, {
          ...node!,
          status: request.status === "SUCCESS" ? "READY" : "UNUSABLE",
          total_amount_funded:
            BigInt(node.total_amount_funded) + BigInt(request.amount),
        });
        this.pendingRequests.delete(peerId);

        // check if it should retry
      } else if (
        request.status === "FAILED" ||
        request.status === "FAILED-DURING-PROCESSING"
      ) {
        log.verbose("retrying request for node", node);
        const requestId = await this.requestFunds(
          BigInt(request.amount),
          node!
        );
        this.savePendingRequest(node.id, requestId, amountOfRetries + 1);
      }
    }
  }
}
