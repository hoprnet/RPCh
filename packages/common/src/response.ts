import type Request from "./request";
import { utils } from "ethers";
import debug from "debug";
import { createLogger } from "./utils";
import type {
  Envelope,
  unbox_response,
  box_response,
} from "@rpch/crypto-for-nodejs";
import Message from "./message";
import * as Compression from "./compression";
import { joinPartsToBody, splitBodyToParts } from "./utils";

const log = createLogger(["response"]);
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
  public static async createResponse(
    // @ts-ignore
    crypto,
    request: Request,
    body: string
  ): Promise<Response> {
    const compressedBody = Compression.compressRpcRequest(body);
    const payload = joinPartsToBody(["response", compressedBody]);
    const envelope = new crypto.Envelope(
      utils.toUtf8Bytes(payload),
      request.entryNodeDestination,
      request.exitNodeDestination
    );
    const resBox = crypto.box_response(request.session, envelope);
    log.info("FOO_resBox", resBox);
    return new Response(request.id, body, request);
  }

  /**
   * Recreate a Response from an incoming Message
   * @param message
   * @param exitNode
   * @returns Request
   */
  public static async fromMessage(
    // @ts-ignore
    crypto,
    request: Request,
    message: Message,
    lastResponseFromExitNode: bigint,
    updateLastResponseFromExitNode: (
      exitNodeId: string,
      counter: bigint
    ) => Promise<void>
  ): Promise<Response> {
    if (!message.body.startsWith("0x"))
      throw Error("Message is not a Response");
    const payload = [3, "request", "foobar", "barfoo"].join("|");
    const envelope = new crypto.Envelope(
      utils.toUtf8Bytes(payload),
      request.exitNodeDestination,
      request.entryNodeDestination
    );
    const EXIT_NODE_PUB_KEY_A =
      "0x021d5401d6fa65591e4a08a2fdff6c7687f1de5a2326ed8ade69b69e6fe9b9d59f";
    const exitNodeReadIdentity = crypto.Identity.load_identity(
      utils.arrayify(EXIT_NODE_PUB_KEY_A)
    );
    const session = crypto.box_request(envelope, exitNodeReadIdentity);

    const resUnbox = crypto.unbox_response(
      session,
      new crypto.Envelope(
        utils.arrayify(message.body),
        request.entryNodeDestination,
        request.exitNodeDestination
      ),
      BigInt(11)
    );

    log.info("FOO_resUnbox", resUnbox);
    await updateLastResponseFromExitNode(
      request.exitNodeDestination,
      request.session.updated_counter()
    );

    const decrypted = utils.toUtf8String(request.session.get_response_data());
    const [type, compressedDecrypted] = splitBodyToParts(decrypted);
    const decompressedDecrypted =
      Compression.decompressRpcRequest(compressedDecrypted);
    if (type !== "response") throw Error("Message is not a Response");
    return new Response(request.id, decompressedDecrypted, request);
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
