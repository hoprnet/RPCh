export type Result = "success" | "dishonest" | "none";

export type ResponseMetric = {
  id: string;
  createdAt: Date;
  result: Result;
};

export default class ReliabilityScore {
  // metrics should be public or private?
  public metrics = new Map<
    string,
    {
      responses: Map<string, ResponseMetric>;
      sent: number;
      updatedAt: Date;
    }
  >();

  public score = new Map<string, number>();

  public addMetric(peerId: string, requestId: string, result: Result) {
    // it's like a spread (...) for Maps. How to do this better?
    const responses = this.metrics.has(peerId)
      ? new Map(this.metrics.get(peerId)?.responses)
      : new Map<string, ResponseMetric>();

    this.metrics.set(peerId, {
      responses: responses.set(requestId, {
        id: "id1",
        createdAt: new Date(),
        result,
      }),
      sent: 0,
      updatedAt: new Date(),
    });
  }

  public getScore(peerId: string) {
    if (this.metrics.has(peerId)) {
      const sent = this.metrics.get(peerId)!.sent;
      if (sent < 20) {
        this.score.set(peerId, 0.2);
      } else if (sent >= 20) {
        // TODO: Add dishonest.
        const dishonest = 0;
        if (dishonest > 0) {
          this.score.set(peerId, 0);
        } else {
          // TODO: Add failed.
          const failed = 0;
          const score = (sent - failed) / sent;
          this.score.set(peerId, score);
        }
      }
      return this.score.get(peerId);
    }
    return 0;
  }
}
