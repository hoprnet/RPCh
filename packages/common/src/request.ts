import Message from "./message";
import Response from "./response";
import {
  generateRandomNumber,
  joinPartsToBody,
  splitBodyToParts,
} from "./utils";
import { Identity } from "./crypto";
import { Envelope, box_request, unbox_request, Session } from "rpch-crypto";

/**
 * Represents a request made by the RPCh.
 * To be send over the HOPR network via Request.toMessage().
 */
export default class Request {
  private constructor(
    public readonly id: number,
    public readonly provider: string,
    public readonly body: string,
    public readonly entryNode: Identity,
    public readonly exitNode: Identity,
    public readonly session: Session
  ) {}

  /**
   * Create a new Request
   * @param provider
   * @param body
   * @param entryNode
   * @param exitNode
   * @returns Request
   */
  public static createRequest(
    provider: string,
    body: string,
    entryNode: Identity,
    exitNode: Identity
  ): Request {
    const id = generateRandomNumber();
    const payload = joinPartsToBody(["request", provider, body]);
    const envelope = new Envelope(
      new TextEncoder().encode(payload),
      entryNode.peerId.toB58String(),
      exitNode.peerId.toB58String()
    );
    const session = box_request(envelope, exitNode.getIdentity(BigInt(0)));

    return new Request(id, provider, body, entryNode, exitNode, session);
  }

  /**
   * Recreate a Request from an incoming Message
   * @param message
   * @param exitNode
   * @returns Request
   */
  public static fromMessage(message: Message, exitNode: Identity): Request {
    const [origin, encrypted] = splitBodyToParts(message.body);

    const entryNode = new Identity(origin);

    const pubKey = entryNode.pubKey;
    const encArr = new TextEncoder().encode(encrypted);
    const merged = new Uint8Array(pubKey.length + encArr.length);
    merged.set(pubKey);
    merged.set(encArr);

    const session = unbox_request(
      new Envelope(
        encArr,
        entryNode.peerId.toB58String(),
        exitNode.peerId.toB58String()
      ),
      exitNode.getIdentity(BigInt(0)),
      BigInt(0)
    );

    const [type, provider, ...remaining] = splitBodyToParts(
      new TextDecoder().decode(session.get_request_data())
    );

    if (type !== "request") throw Error("Message is not a Request");
    return new Request(
      message.id,
      provider,
      joinPartsToBody(remaining),
      entryNode,
      exitNode,
      session
    );
  }

  /**
   * Convert Request to a Message
   * @returns Message
   */
  public toMessage(): Message {
    const message = new Message(
      this.id,
      joinPartsToBody([
        this.entryNode.peerId.toB58String(),
        new TextDecoder().decode(this.session.get_request_data()),
      ])
    );

    return message;
  }

  /**
   * Given the Request, create a Response
   * @param body
   * @returns Response
   */
  public createResponse(body: string): Response {
    return Response.fromRequest(this, body);
  }
}
