/**
 * NOTES: works on nodeJS only
 */

import { ecdh } from "secp256k1";
import { toBufferBE } from "bigint-buffer";
import { Identity, Envelope, Session } from "./types";
import { createEphemeralIdentity, createCipher } from "./utils";
import { RPCH_CRYPTO_VERSION, REQUEST_TAG, COUNTER_SIZE } from "./constants";
import { randomBytes } from "crypto";

function boxRequest(
  request: Envelope,
  exitNode: Identity,
  exitRequestCounter: bigint
): Session {
  const ephemeral_identity = createEphemeralIdentity();
  console.log(ephemeral_identity.pubKey.length);
  const shared_presecret = ecdh(exitNode.pubKey, ephemeral_identity.privKey!);
  const new_counter = exitRequestCounter + BigInt(1);

  let { cipher, iv } = createCipher(
    shared_presecret,
    new_counter,
    Buffer.concat([
      RPCH_CRYPTO_VERSION,
      Buffer.from(request.exitPubKey), // probably a bug,
      REQUEST_TAG,
    ])
  );

  const cipher_text = cipher.encrypt(Buffer.from(request.message));
  const result = Buffer.concat([
    RPCH_CRYPTO_VERSION,
    ephemeral_identity.pubKey,
    Buffer.from(toBufferBE(new_counter, COUNTER_SIZE)),
    cipher_text,
  ]);

  return new Session(new_counter, shared_presecret, result);
}

// test

const entryNodePubKey = createEphemeralIdentity().pubKey;
const exitNodePubKey = createEphemeralIdentity().pubKey;
const plainMessage = Buffer.from("hello world", "utf-8");
const exitNodeCounter = BigInt(0);
const envelope = new Envelope(entryNodePubKey, exitNodePubKey, plainMessage);

console.log(
  boxRequest(envelope, new Identity(exitNodePubKey), exitNodeCounter)
);
