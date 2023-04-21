import fetch, { Response } from "node-fetch";
import {
  GetAccessTokenResponse,
  GetRequestStatusResponse,
  PostFundingRequest,
  PostFundingResponse,
  RegisteredNodeDB,
} from "../types";
import { isExpired } from "../utils";
import { DBInstance } from "../db";
import { getRegisteredNode, updateRegisteredNode } from "../registered-node";
import { createLogger } from "../utils";
import { createFundingRequest } from "../funding-request";
import retry from "async-retry";

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
  private amountLeft: string | undefined;
  // Map of all pending requests
  private pendingRequests: Map<
    //requestId
    number,
    { amountOfRetries: number; previousRequestId: number; peerId: string }
  > = new Map();
  // Amount of times a request can fail and be sent again
  private maxAmountOfRetries = 3;

  constructor(private url: string, private db: DBInstance) {}

  /**
   * Save new access token to instance
   * @param ops
   */
  private saveAccessToken(ops: GetAccessTokenResponse): void {
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
    const resJson = (await res.json()) as GetAccessTokenResponse;
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
    if (!this.accessToken || !this.accessTokenIsValid(amount)) {
      const accessToken = await this.fetchAccessToken();
      return accessToken;
    } else {
      return this.accessToken;
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
    if (amount && BigInt(this.amountLeft) < amount) {
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
   * @param prevRetries number of times funding request has failed
   * @returns
   */
  public async requestFunds(params: {
    amount: bigint;
    node: RegisteredNodeDB;
    previousRequestId?: number;
    amountOfRetries?: number;
  }) {
    try {
      const { amount, node } = params;
      const dbNode = await getRegisteredNode(this.db, node.id);
      if (!dbNode) throw new Error("Node is not registered");

      log.verbose("requesting to funding service", {
        amount: amount.toString(),
        chainId: dbNode.chain_id,
        peerId: dbNode.id,
      });

      const res = await this.fetchRequestFunds(dbNode, amount);

      let fundingResponseJson = (await res.json()) as PostFundingResponse;

      log.verbose("funding service response", fundingResponseJson);

      const { id: requestId, amountLeft } = fundingResponseJson;

      await updateRegisteredNode(this.db, {
        ...dbNode,
        status: "FUNDING",
      });

      // save funding request in db
      await createFundingRequest(this.db, {
        registeredNodeId: dbNode.id,
        requestId,
        amount: amount,
      });

      this.amountLeft = amountLeft;

      this.savePendingRequest({
        requestId,
        peerId: node.id,
        previousRequestId: params.previousRequestId,
        amountOfRetries: params.amountOfRetries,
      });

      return requestId;
    } catch (e: any) {
      throw new Error(e.message);
    }
  }

  /**
   * Get available funds from funding service
   */
  public async getAvailableFunds() {
    await this.getAccessToken();

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
    await this.getAccessToken();

    const res = await fetch(`${this.url}/api/request/status/${requestId}`, {
      headers: {
        "x-access-token": this.accessToken!,
      },
    });

    const resJson = (await res.json()) as GetRequestStatusResponse;

    return resJson;
  }

  /**
   * Save new request to pending requests so we can track it
   */
  private savePendingRequest(params: {
    requestId: number;
    peerId: string;
    previousRequestId?: number;
    amountOfRetries?: number;
  }) {
    this.pendingRequests.set(params.requestId, {
      previousRequestId: params.previousRequestId ?? 0,
      amountOfRetries: params.amountOfRetries ?? 0,
      peerId: params.peerId,
    });
  }

  /**
   * Goes through all pending requests and chooses to prune/retry/ignore
   */
  public async checkForPendingRequests() {
    log.verbose(
      "pending requests",
      this.pendingRequests.size ? [...this.pendingRequests.keys()] : []
    );
    const snapshotPendingRequests = [...this.pendingRequests.entries()];
    for (const [
      requestId,
      { amountOfRetries, previousRequestId, peerId },
    ] of snapshotPendingRequests) {
      log.verbose("handling pending request", requestId);
      const request = await this.getRequestStatus(String(requestId));
      const node = await getRegisteredNode(this.db, peerId);

      if (!node) throw new Error("Registered node does not exist");

      log.verbose(
        `request id: ${requestId} is in status ${request.status}
        for node ${node.id}`
      );

      // checks if it should prune
      if (
        request.status === "SUCCESS" ||
        request.status === "REJECTED-DURING-PROCESSING"
      ) {
        await updateRegisteredNode(this.db, {
          ...node,
          status: request.status === "SUCCESS" ? "READY" : "UNUSABLE",
          total_amount_funded:
            BigInt(node.total_amount_funded) + BigInt(request.amount),
        });
        log.verbose(
          "request has been fulfilled",
          request.status,
          requestId,
          peerId
        );
        this.pendingRequests.delete(requestId);

        // check if it should retry
      } else if (
        request.status === "FAILED" ||
        request.status === "FAILED-DURING-PROCESSING"
      ) {
        if (amountOfRetries < this.maxAmountOfRetries) {
          log.verbose("retrying request for node", node);
          const previousRequestId = requestId;
          const newRequestId = await this.requestFunds({
            amount: BigInt(request.amount),
            node: node,
            amountOfRetries: amountOfRetries + 1,
            previousRequestId,
          });
          log.verbose(
            `deleting old request id ${previousRequestId} because
            request will be fulfilled with request id ${newRequestId}`
          );
          this.pendingRequests.delete(previousRequestId);
          this.savePendingRequest({
            peerId: node.id,
            requestId: newRequestId,
            amountOfRetries: amountOfRetries + 1,
            previousRequestId,
          });
        } else {
          log.error(
            `could not fund node ${node.id} with request id ${requestId}
            and previous request id ${previousRequestId}`
          );
          this.pendingRequests.delete(requestId);
          await updateRegisteredNode(this.db, {
            ...node,
            status: "READY",
          });
        }
      }
    }
  }

  public async fetchRequestFunds(
    dbNode: RegisteredNodeDB,
    amount: bigint,
    opts?: retry.Options | undefined
  ): Promise<Response> {
    const res = await retry(
      async (bail) => {
        await this.getAccessToken(amount);
        const body: PostFundingRequest = {
          amount: amount.toString(),
          chainId: dbNode.chain_id,
        };
        // if anything throws, we retry
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

        if (401 === res.status) {
          await this.fetchAccessToken();
          throw new Error("access token is no longer valid");
        }

        if (500 === res.status || 400 == res.status || 404 === res.status) {
          // don't retry upon 500, 400 or 404
          log.error("funding request failed", res.status, await res.text());
          bail(new Error("funding request failed"));
          return;
        }

        return res;
      },
      {
        retries: 3,
        ...opts,
      }
    );

    if (!res) {
      throw new Error("funding request failed");
    }

    return res;
  }
}
