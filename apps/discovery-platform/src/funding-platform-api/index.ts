const FUNDING_PLATFORM_API = "";
export class FundingPlatformApi {
  private accessToken: string | undefined;
  private expiredAt: Date | undefined;

  constructor() {}

  public getAccessToken() {
    return this.accessToken ?? this.generateAccessToken();
  }

  private generateAccessToken() {
    this.accessToken = "";
    return this.accessToken;
  }

  private validateAccessToken() {}

  public requestFunds() {}

  public getStatusOfRequest(requestId: number) {}
}
