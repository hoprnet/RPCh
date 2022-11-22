import { Cache, Request, Response, Segment } from "rpch-commons";
import RequestCache from "./request-cache";
import { sendMessage, createMessageListener } from "./hoprd";
import { utils } from "rpch-commons";
const { createLogger } = utils;

const { log } = createLogger();

const MOCK_DISCOVERY_PLATFORM_API_ENDPOINT = "https://localhost:3000";
const MOCK_API_TOKEN = "123456789";
const MOCK_DESTINATION =
  "16Uiu2HAmM9KAPaXA4eAz58Q7Eb3LEkDvLarU4utkyL6vM5mwDeEK";
const TIMEOUT = 60e3;
export default class SDK {
  private cache: Cache;
  private requestCache: RequestCache;

  constructor() {
    this.requestCache = new RequestCache(TIMEOUT);
    this.cache = new Cache(
      TIMEOUT,
      this.requestCache.onRequestFromSegments,
      this.requestCache.onResponseFromSegments
    );
  }

  public async requestMessagingAccessToken(
    apiEndpoint: string,
    apiToken: string
  ) {
    // get api token access
    // open listener
    await createMessageListener(
      MOCK_DISCOVERY_PLATFORM_API_ENDPOINT,
      MOCK_API_TOKEN,
      (message) => {
        try {
          const segment = Segment.fromString(message);
          this.cache.onSegment(segment);
        } catch (e) {
          log(
            "rejected received data from HOPRd: not a valid segment",
            message
          );
        }
      }
    );
    this.requestCache.setInterval();
  }

  public createRequest(
    origin: string,
    provider: string,
    destination: string
  ): Request {
    return Request.fromData(origin, provider, destination);
  }

  public sendRequest(req: Request): Promise<Response> {
    return new Promise(async (resolve, reject) => {
      const message = req.toMessage();
      const segments = message.toSegments();
      this.requestCache.addRequest(req, resolve, reject);
      for (const segment of segments) {
        await sendMessage({
          apiEndpoint: MOCK_DISCOVERY_PLATFORM_API_ENDPOINT,
          apiToken: MOCK_API_TOKEN,
          message: segment.toString(),
          destination: MOCK_DESTINATION,
        });
      }
    });
  }
}
