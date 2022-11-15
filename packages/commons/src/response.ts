import Message from "./message";

const SEPERATOR = "|";

/**
 * Represents a response made by a RPCh.
 * To be send over the HOPR network via Response.toMessage().
 */
export default class Response {
  constructor(public readonly id: number, public readonly body: string) {}

  public static fromMessage(message: Message): Response {
    const [type, ...body] = message.body.split(SEPERATOR);
    if (type !== "response") throw Error("Message is not a Response");
    return new Response(message.id, body.join(SEPERATOR));
  }

  public toMessage(): Message {
    return new Message(this.id, ["response", this.body].join(SEPERATOR));
  }
}
