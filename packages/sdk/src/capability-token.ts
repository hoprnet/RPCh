import { createLogger } from "./utils";
import fetch from "cross-fetch";

const MAX_CALLS = 10e3;
const EXPIRE_TIME = 60e3 * 30; // 30 minutes in milliseconds

const log = createLogger(["capability-token"]);

export default class CapabilityToken {
  private expireTime: number;
  private usedCalls: number;

  /**
   * Creates a new CapabilityToken instance.
   *
   * @param discoveryPlatformApiEndpoint The API endpoint for the discovery platform.
   * @param selectedNodeId The ID of the selected node.
   * @param token The capability token string.
   */
  constructor(
    private discoveryPlatformApiEndpoint: string,
    private selectedNodeId: string,
    private token: string
  ) {
    this.expireTime = Date.now() + EXPIRE_TIME;
    this.usedCalls = 0;
    log.normal("Started new capability token:", token);
  }

  /**
   * Sends a request to the discovery platform to get a new capability token.
   *
   * @returns A promise that resolves to an object containing the new capability token.
   */
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

  /**
   * Checks whether the current capability token has expired.
   *
   * @param messages The number of messages sent.
   * @returns A boolean indicating whether the current token has expired.
   */
  private isTokenExpired(messages: number): boolean {
    log.verbose("capability token stats: ", {
      expired: Date.now() > this.expireTime,
      usedMoreThanThanMaxCalls: this.usedCalls >= MAX_CALLS,
    });
    return (
      Date.now() > this.expireTime || this.usedCalls + messages >= MAX_CALLS
    );
  }

  /**
   * Updates the capability token data, such as the token string and usage statistics.
   *
   * @param messages The number of messages sent.
   * @returns A promise that resolves when the update is complete.
   */
  public async updateTokenData(messages: number): Promise<void> {
    if (this.isTokenExpired(messages)) {
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

  /**
   * Sends a panic request to the discovery platform to get a new capability token.
   *
   * @returns A promise that resolves when the new token is received.
   */
  public async panicRequestToken() {
    const newTokenData = await this.requestNewToken();
    this.token = newTokenData.token;
  }

  /**
   * Returns the current capability token.
   *
   * @returns The current capability token.
   */
  public getToken(): string {
    return this.token;
  }
}
