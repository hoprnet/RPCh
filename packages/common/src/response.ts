import Message from "./message";
import { joinPartsToBody, splitBodyToParts } from "./utils";
import {
  box_response,
  unbox_response,
  Identity,
  Envelope,
  Session,
} from "./crypto-lib";

/**
 * Represents a response made by a RPCh.
 * To be send over the HOPR network via Response.toMessage().
 */
export default class Response {
  constructor(public readonly id: number, public readonly body: string) {}

  public static fromMessage(
    message: Message,
    crypto: {
      session: Session;
      exitNodeIdentity: Identity;
      entryNodePeerId: string;
      exitNodePeerId: string;
    }
  ): Response {
    unbox_response(
      crypto.session,
      new Envelope(
        new TextEncoder().encode(message.body),
        crypto.entryNodePeerId,
        crypto.exitNodePeerId
      ),
      crypto.exitNodeIdentity
    );
    const unboxed_rpc_response = crypto.session.get_response_data();

    const [type, ...remaining] = splitBodyToParts(
      new TextDecoder().decode(unboxed_rpc_response)
    );
    if (type !== "response") throw Error("Message is not a Response");
    return new Response(message.id, joinPartsToBody(remaining));
  }

  public toMessage(crypto: {
    session: Session;
    exitNodeIdentity: Identity;
    entryNodePeerId: string;
    exitNodePeerId: string;
  }): Message {
    box_response(
      crypto.session,
      new Envelope(
        new TextEncoder().encode(joinPartsToBody(["response", this.body])),
        crypto.entryNodePeerId,
        crypto.exitNodePeerId
      ),
      crypto.exitNodeIdentity
    );

    let boxed_response = crypto.session.get_response_data();

    return new Message(this.id, new TextDecoder().decode(boxed_response));
  }
}
