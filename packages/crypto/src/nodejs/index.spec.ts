import assert from "assert";
import { utils } from "ethers";
import PeerId from "peer-id";
import {
  set_panic_hook,
  Identity,
  Envelope,
  box_request,
  unbox_request,
  box_response,
  unbox_response,
} from ".";

set_panic_hook();

const PRIV_KEY_EXIT_NODE = utils.arrayify(
  "0x1a7a8c37e30c97ebf532042bdc37fe724a3950b0cd7ea5a57c9f3e30c53c44a3"
);

const PUB_KEY_EXIT_NODE = utils.arrayify(
  "0x021be92a59234dbef617f5eb0d5426758a6cad16f951458a3d753aa22c09e75509"
);

const PEER_ID_ENTRY_NODE = PeerId.createFromB58String(
  "16Uiu2HAmA5h2q7G2RrZMA4znAH4p8KBcuJWUmjjVfpW5DXePQ2He"
);
const PEER_ID_EXIT_NODE = PeerId.createFromB58String(
  "16Uiu2HAkwJdCap1ErGKjtLeHjfnN53TD8kryG48NYVPWx4HhRfKW"
);

const REQ_BODY = "thisisrequest";
const REQ_BODY_U8A = utils.toUtf8Bytes(REQ_BODY);

const RES_BODY = "thisisresponse";
const RES_BODY_U8A = utils.toUtf8Bytes(RES_BODY);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("test index.ts", function () {
  let client_last_request_ts = BigInt(0);
  let exit_last_response_ts = BigInt(0);

  it("should do the whole flow first time", async function () {
    // --> on client
    const client_session = box_request(
      new Envelope(
        REQ_BODY_U8A,
        PEER_ID_ENTRY_NODE.toB58String(),
        PEER_ID_EXIT_NODE.toB58String()
      ),
      // exit node identity
      Identity.load_identity(PUB_KEY_EXIT_NODE)
    );

    await wait(100);

    // --> exit node
    const encrypted_req_data_received = client_session.get_request_data();
    const exit_node_session = unbox_request(
      new Envelope(
        encrypted_req_data_received,
        PEER_ID_ENTRY_NODE.toB58String(),
        PEER_ID_EXIT_NODE.toB58String()
      ),
      Identity.load_identity(PUB_KEY_EXIT_NODE, PRIV_KEY_EXIT_NODE),
      client_last_request_ts
    );

    client_last_request_ts = exit_node_session.updated_counter();

    assert.equal(
      utils.toUtf8String(exit_node_session.get_request_data()),
      utils.toUtf8String(REQ_BODY_U8A)
    );

    box_response(
      exit_node_session,
      new Envelope(
        RES_BODY_U8A,
        PEER_ID_ENTRY_NODE.toB58String(),
        PEER_ID_EXIT_NODE.toB58String()
      )
    );

    await wait(100);

    // --> client
    const encrypted_res_data_received = exit_node_session.get_response_data();
    unbox_response(
      client_session,
      new Envelope(
        encrypted_res_data_received,
        PEER_ID_ENTRY_NODE.toB58String(),
        PEER_ID_EXIT_NODE.toB58String()
      ),
      exit_last_response_ts
    );

    exit_last_response_ts = client_session.updated_counter();

    assert.equal(
      utils.toUtf8String(client_session.get_response_data()),
      utils.toUtf8String(RES_BODY_U8A)
    );
  });

  it("should do the whole flow second time", async function () {
    // --> on client
    const client_session = box_request(
      new Envelope(
        REQ_BODY_U8A,
        PEER_ID_ENTRY_NODE.toB58String(),
        PEER_ID_EXIT_NODE.toB58String()
      ),
      // exit node identity
      Identity.load_identity(PUB_KEY_EXIT_NODE)
    );

    await wait(100);

    // --> exit node
    const encrypted_req_data_received = client_session.get_request_data();
    const exit_node_session = unbox_request(
      new Envelope(
        encrypted_req_data_received,
        PEER_ID_ENTRY_NODE.toB58String(),
        PEER_ID_EXIT_NODE.toB58String()
      ),
      Identity.load_identity(PUB_KEY_EXIT_NODE, PRIV_KEY_EXIT_NODE),
      client_last_request_ts
    );

    client_last_request_ts = exit_node_session.updated_counter();

    assert.equal(
      utils.toUtf8String(exit_node_session.get_request_data()),
      utils.toUtf8String(REQ_BODY_U8A)
    );

    box_response(
      exit_node_session,
      new Envelope(
        RES_BODY_U8A,
        PEER_ID_ENTRY_NODE.toB58String(),
        PEER_ID_EXIT_NODE.toB58String()
      )
    );

    await wait(100);

    // --> client
    const encrypted_res_data_received = exit_node_session.get_response_data();
    unbox_response(
      client_session,
      new Envelope(
        encrypted_res_data_received,
        PEER_ID_ENTRY_NODE.toB58String(),
        PEER_ID_EXIT_NODE.toB58String()
      ),
      exit_last_response_ts
    );

    exit_last_response_ts = client_session.updated_counter();

    assert.equal(
      utils.toUtf8String(client_session.get_response_data()),
      utils.toUtf8String(RES_BODY_U8A)
    );
  });
});
