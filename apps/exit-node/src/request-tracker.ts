/**
 * Responsible for keeping track of all requests received.
*/
import { Request, Response } from "rpch-commons";
import { utils } from "rpch-commons";
const {createLogger} = utils;

const {log, logVerbose} = createLogger("exit")

export default class RequestTracker {
  private requests = new Map<number, {request: Request, receivedAt: Date}>;
  constructor(private timeout: number) {};

  public addRequest(request: Request){
    this.requests.set(request.id, {request, receivedAt: new Date()});
  }

  public onResponse(response: Response){

  }

  public setInterval(timeout: number){
    this.timeout = timeout;
  }

  public checkExpiredRequests(){
    for(const requestKey of this.requests.keys()){
      if(this.requests.has(requestKey) && (new Date().getDate() - this.requests.get(requestKey)!.receivedAt.getDate()) > this.timeout){
        log(`Request ${requestKey} timed out. Deleting`);
        this.requests.delete(requestKey);
      }
    }
  }
}