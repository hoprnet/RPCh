import Message from "./message";
import type Request from "./request";
import { joinPartsToBody, splitBodyToParts } from "./utils";
import { Identity } from "./crypto";
import { Envelope, Session, unbox_response, box_response } from "rpch-crypto";

/**
 * Represents a response made by a RPCh.
 * To be send over the HOPR network via Response.toMessage().
 */
export default class Response {
  private constructor(
    public readonly id: number,
    public readonly body: string,
    public readonly entryNode: Identity,
    public readonly exitNode: Identity,
    public readonly session: Session
  ) {}

  /**
   * Create a Response for a given Request
   * @param request
   * @param body
   * @return Response
   */
  public static fromRequest(request: Request, body: string): Response {
    unbox_response(
      request.session,
      new Envelope(
        new TextEncoder().encode(body),
        request.entryNode.peerId.toB58String(),
        request.exitNode.peerId.toB58String()
      )
    );

    const decrypted = request.session.get_response_data();

    const [type, ...remaining] = splitBodyToParts(
      new TextDecoder().decode(decrypted)
    );
    if (type !== "response") throw Error("Message is not a Response");
    return new Response(
      request.id,
      joinPartsToBody(remaining),
      request.entryNode,
      request.exitNode,
      request.session
    );
  }

  /**
   * Convert Response to a Message
   * @returns Message
   */
  public toMessage(): Message {
    box_response(
      this.session,
      new Envelope(
        new TextEncoder().encode(joinPartsToBody(["response", this.body])),
        this.entryNode.peerId.toB58String(),
        this.exitNode.peerId.toB58String()
      )
    );

    return new Message(
      this.id,
      new TextDecoder().decode(this.session.get_response_data())
    );
  }
}
