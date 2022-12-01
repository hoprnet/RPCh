import Message from "./message";
import { joinPartsToBody, splitBodyToParts } from "./utils";

/**
 * Represents a response made by a RPCh.
 * To be send over the HOPR network via Response.toMessage().
 */
export default class Response {
  constructor(public readonly id: number, public readonly body: string) {}

  public static fromMessage(message: Message): Response {
    const [type, ...remaining] = splitBodyToParts(message.body);
    if (type !== "response") throw Error("Message is not a Response");
    return new Response(message.id, joinPartsToBody(remaining));
  }

  public toMessage(): Message {
    return new Message(this.id, joinPartsToBody(["response", this.body]));
  }
}
