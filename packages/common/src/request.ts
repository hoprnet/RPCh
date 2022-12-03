import Message from "./message";
import Response from "./response";
import {
  generateRandomNumber,
  joinPartsToBody,
  splitBodyToParts,
} from "./utils";
import {
  Identity,
  Envelope,
  box_request,
  unbox_request,
  Session,
} from "./crypto-lib";

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

  public static fromMessage(
    message: Message,
    crypto: {
      exitNodeIdentity: Identity;
      entryNodePeerId: string;
      exitNodePeerId: string;
    }
  ): Request {
    const [origin, encrypted] = splitBodyToParts(message.body);

    const session = unbox_request(
      new Envelope(
        new TextEncoder().encode(encrypted),
        crypto.entryNodePeerId,
        crypto.exitNodePeerId
      ),
      crypto.exitNodeIdentity
    );

    const [type, provider, ...remaining] = splitBodyToParts(
      new TextDecoder().decode(session.get_request_data())
    );

    if (type !== "request") throw Error("Message is not a Request");
    return new Request(
      message.id,
      origin,
      provider,
      joinPartsToBody(remaining)
    );
  }

  public toMessage(
    entryNodePeerId: string,
    exitNodePeerId: string,
    exitNodeIdentity: Identity
  ): { message: Message; session: Session } {
    // create payload to encrypt
    const payload = joinPartsToBody(["request", this.provider, this.body]);

    const envelope = new Envelope(
      new TextEncoder().encode(payload),
      entryNodePeerId,
      exitNodePeerId
    );
    const session = box_request(envelope, exitNodeIdentity);
    const message = new Message(
      this.id,
      joinPartsToBody([
        this.origin,
        new TextDecoder().decode(session.get_response_data()),
      ])
    );

    return { message, session };
  }

  public createResponse(body: string): Response {
    return new Response(this.id, body);
  }
}
