import { createLogger } from "./utils";
import fetch from "cross-fetch";

const MAX_CALLS = 10e3;
const EXPIRE_TIME = 60e3 * 30; // 30 minutes in milliseconds

const log = createLogger(["capability-token"]);

export default class CapabilityToken {
  private expireTime: number;
  private usedCalls: number;

  constructor(
    private discoveryPlatformApiEndpoint: string,
    private selectedNodeId: string,
    private token: string
  ) {
    this.expireTime = Date.now() + EXPIRE_TIME;
    this.usedCalls = 0;
    log.normal("Started new capability token:", token);
  }

  public async requestNewToken(): Promise<{ token: string }> {
    const rawResponse: globalThis.Response = await fetch(
      new URL(
        `/api/v1/node/${this.selectedNodeId}/refresh`,
        this.discoveryPlatformApiEndpoint
      ).toString(),
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Accept-Content": "application/json",
          "x-auth-token": this.token,
        },
      }
    );

    const response: {
      token: string;
    } = await rawResponse.json();

    // Check for error response
    if (rawResponse.status !== 200) {
      log.error(
        "Failed to get new token from discovery platform",
        rawResponse.status,
        response
      );
      throw new Error(`Failed to get new token from discovery platform`);
    }

    return response;
  }

  private isTokenExpired(): boolean {
    log.verbose("capability token stats: ", {
      expired: Date.now() > this.expireTime,
      usedMoreThanThanMaxCalls: this.usedCalls >= MAX_CALLS,
    });
    return Date.now() > this.expireTime || this.usedCalls >= MAX_CALLS;
  }

  public async updateTokenData(messages: number): Promise<void> {
    if (this.isTokenExpired()) {
      log.normal("Capability token expired");
      // if the token has expired or reached its usage limit, request a new one
      const newTokenData = await this.requestNewToken();
      this.token = newTokenData.token;
      this.expireTime = Date.now() + EXPIRE_TIME;
      this.usedCalls = 0;
    } else {
      // update the used calls counter
      this.usedCalls = this.usedCalls + messages;
    }
  }

  public getToken(): string {
    return this.token;
  }
}
