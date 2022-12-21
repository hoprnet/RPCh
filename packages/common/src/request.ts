import Message from "./message";
import {
  generateRandomNumber,
  joinPartsToBody,
  splitBodyToParts,
  Identity,
} from "./utils";
import {
  Envelope,
  box_request,
  unbox_request,
  Session,
} from "rpch-crypto/nodejs";
import { utils } from "ethers";

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
      utils.toUtf8Bytes(payload),
      entryNode.peerId.toB58String(),
      exitNode.peerId.toB58String()
    );
    const session = box_request(envelope, exitNode.cryptoIdentity);

    return new Request(id, provider, body, entryNode, exitNode, session);
  }

  /**
   * Recreate a Request from an incoming Message
   * @param message
   * @param exitNode
   * @returns Request
   */
  public static fromMessage(
    message: Message,
    exitNode: Identity,
    lastRequestFromClient: bigint,
    updateLastRequestFromClient: (counter: bigint) => any
  ): Request {
    const [origin, encrypted] = splitBodyToParts(message.body);

    const entryNode = new Identity(origin);

    const session = unbox_request(
      new Envelope(
        utils.arrayify(encrypted),
        entryNode.peerId.toB58String(),
        exitNode.peerId.toB58String()
      ),
      exitNode.cryptoIdentity,
      lastRequestFromClient
    );

    updateLastRequestFromClient(session.updated_counter());

    const [type, provider, ...remaining] = splitBodyToParts(
      utils.toUtf8String(session.get_request_data())
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
        utils.hexlify(this.session.get_request_data()),
      ])
    );

    return message;
  }
}
