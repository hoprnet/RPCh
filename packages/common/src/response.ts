import type Request from "./request";
import type { Envelope, box_response, unbox_response } from "rpch-crypto/web";
// } from "rpch-crypto/nodejs";
import Message from "./message";
import { joinPartsToBody, splitBodyToParts } from "./utils";
import { utils } from "ethers";

/**
 * Represents a response made by a RPCh.
 * To be send over the HOPR network via Response.toMessage().
 */
export default class Response {
  private constructor(
    public readonly id: number,
    public readonly body: string,
    public readonly request: Request
  ) {}

  /**
   * Create a Response for a given Request
   * @param request
   * @param body
   * @return Response
   */
  public static createResponse(
    crypto: {
      Envelope: typeof Envelope;
      box_response: typeof box_response;
    },
    request: Request,
    body: string
  ): Response {
    const payload = joinPartsToBody(["response", body]);
    const envelope = new crypto.Envelope(
      utils.toUtf8Bytes(payload),
      request.entryNodeDestination,
      request.exitNodeDestination
    );
    crypto.box_response(request.session, envelope);
    return new Response(request.id, body, request);
  }

  /**
   * Recreate a Response from an incoming Message
   * @param message
   * @param exitNode
   * @returns Request
   */
  public static fromMessage(
    crypto: {
      Envelope: typeof Envelope;
      unbox_response: typeof unbox_response;
    },
    request: Request,
    message: Message,
    lastResponseFromExitNode: bigint,
    updateLastResponseFromExitNode: (exitNodeId: string, counter: bigint) => any
  ): Response {
    crypto.unbox_response(
      request.session,
      new crypto.Envelope(
        utils.arrayify(message.body),
        request.entryNodeDestination,
        request.exitNodeDestination
      ),
      lastResponseFromExitNode
    );

    updateLastResponseFromExitNode(
      request.exitNodeDestination,
      request.session.updated_counter()
    );

    const decrypted = utils.toUtf8String(request.session.get_response_data());

    const [type, body] = splitBodyToParts(decrypted);
    if (type !== "response") throw Error("Message is not a Response");
    return new Response(request.id, body, request);
  }

  /**
   * Convert Response to a Message
   * @returns Message
   */
  public toMessage(): Message {
    const message = new Message(
      this.id,
      utils.hexlify(this.request.session.get_response_data())
    );

    return message;
  }
}
