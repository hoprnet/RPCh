import { Cache as SegmentsCache, Request, Response, utils } from "rpch-commons";

const { log, logVerbose, logError } = utils.createLogger("request-cache");

export default class RequestCache {
  // requests we have made to another relay, keyed by message.id
  private requests = new Map<
    number,
    {
      request: Request;
      createdAt: Date;
      resolve: (value: Response | PromiseLike<Response>) => void;
      reject: (reason?: any) => void;
    }
  >();

  constructor(private timeout: number) {}

  public addRequest(
    req: Request,
    resolve: (value: Response | PromiseLike<Response>) => void,
    reject: (reason?: any) => void
  ): void {
    this.requests.set(req.id, {
      request: req,
      createdAt: new Date(),
      resolve,
      reject,
    });
  }

  public removeRequest(req: Request): void {
    this.requests.delete(req.id);
  }

  public onRequestFromSegments(req: Request): void {}
  public onResponseFromSegments(res: Response): void {}
}
