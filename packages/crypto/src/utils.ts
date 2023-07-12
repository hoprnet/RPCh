import { randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { publicKeyCreate } from "secp256k1";
import { createKeyedHash } from "blake2";
import { toBufferBE } from "bigint-buffer";
import { Identity } from "./types";
import { CIPHER_KEYSIZE, CIPHER_IVSIZE, COUNTER_SIZE } from "./constants";

export function createEphemeralIdentity(): Identity {
  const privateKey = randomBytes(32);
  return new Identity(publicKeyCreate(privateKey, true), privateKey);
}

export function encChaPoly(key: Buffer, iv: Buffer, data: Buffer): Buffer {
  const cipher = createCipheriv("chacha20-poly1305", key, iv, {
    authTagLength: 16,
  });
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

export function decChaPoly(key: Buffer, data: Buffer): Buffer {
  const decipher = createDecipheriv(
    "chacha20-poly1305",
    key,
    Buffer.from(data.subarray(0, 12)),
    {
      authTagLength: 16,
    }
  );
  decipher.setAuthTag(Buffer.from(data.subarray(12, 28)));
  return Buffer.concat([
    decipher.update(Buffer.from(data.subarray(28, data.byteLength))),
    decipher.final(),
  ]);
}

export function createCipher(
  shared_presecret: Uint8Array,
  counter: bigint,
  salt: Buffer
) {
  const kdf = createKeyedHash("blake2s", Buffer.from(shared_presecret)).update(
    salt
  );

  const key = kdf
    .copy()
    .update(Buffer.from(new Uint8Array({ length: CIPHER_KEYSIZE })))
    .digest();
  const ivm = kdf
    .copy()
    .update(
      Buffer.from(new Uint8Array({ length: CIPHER_IVSIZE - COUNTER_SIZE }))
    )
    .digest();
  const iv = Buffer.concat([ivm, toBufferBE(counter, COUNTER_SIZE)]);

  const cipher = {
    encrypt: function encrypt(message: Buffer) {
      return encChaPoly(key, iv, message);
    },
    decrypt: function decrypt(data: Buffer) {
      return decChaPoly(key, data);
    },
  };

  return { cipher, iv };
}
