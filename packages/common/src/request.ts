import Message from "./message";
import Response from "./response";
import {
  generateRandomNumber,
  joinPartsToBody,
  splitBodyToParts,
} from "./utils";

/**
 * Represents a request made by the RPCh.
 * To be send over the HOPR network via Request.toMessage().
 */
export default class Request {
  constructor(
    public readonly id: number,
    public readonly origin: string,
    public readonly provider: string,
    public readonly body: string
  ) {}

  public static fromData(
    origin: string,
    provider: string,
    body: string
  ): Request {
    return new Request(generateRandomNumber(), origin, provider, body);
  }

  public static fromMessage(message: Message): Request {
    const [type, origin, provider, ...remaining] = splitBodyToParts(
      message.body
    );
    if (type !== "request") throw Error("Message is not a Request");
    return new Request(
      message.id,
      origin,
      provider,
      joinPartsToBody(remaining)
    );
  }

  public toMessage(): Message {
    return new Message(
      this.id,
      joinPartsToBody(["request", this.origin, this.provider, this.body])
    );
  }

  public createResponse(body: string): Response {
    return new Response(this.id, body);
  }
}
