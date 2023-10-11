import { hash_length, extract, expand } from 'futoin-hkdf'
import { chacha20poly1305 } from '@noble/ciphers/chacha'
import { randomBytes } from 'crypto'
import {
  ecdh,
  privateKeyVerify,
  publicKeyCreate
} from 'secp256k1'


export type Envelope = {
  message: Uint8Array,
  entryPeerId: string,
  exitPeerId: string,
}

export class Identity {
  constructor(private publicKey: Uint8Array, private privateKey?: Uint8Array) {}
}

export type Session = {
  request: Uint8Array,
  response: Uint8Array,
  updatedTS: Date
}

export class Result<T> {
  constructor(public readonly ok: T | undefined, public readonly error: string, public readonly is_err: boolean) {
  }
  public static ok<T>(res: T) {
    return new Result<T>(res, "", false)
  }
  public static err<T>(err: string) {
    return new Result<T>(undefined, err, true)
  }
}

const TIMESTAMP_TOLERANCE_MS = 30_000; // milliseconds
const CIPHER_KEY_LEN = 32;
const CIPHER_IV_LEN = 12;
const COUNTER_LEN = 4;
const BLAKE2S256_HASH = 'blake2s256'

function initializeCipher(shared_presecret: Uint8Array, counter: number, salt: Uint8Array, startIndex: number) {
  const hashLen = hash_length(BLAKE2S256_HASH);
  const prk = extract(BLAKE2S256_HASH, hashLen, Buffer.from(shared_presecret), Buffer.from(salt))

  const cipherKeyLen = CIPHER_KEY_LEN;
  const cipherIvLen = CIPHER_IV_LEN - COUNTER_LEN;
  const idx = new Uint8Array(1);

  idx[0] = startIndex;
  const key = expand(BLAKE2S256_HASH, hashLen, prk, cipherKeyLen, Buffer.from(idx))
  idx[0] = startIndex + 1;
  const ivm = expand(BLAKE2S256_HASH, hashLen, prk, cipherIvLen, Buffer.from(idx))
  ivm.writeUint32BE(counter, cipherIvLen)

  return chacha20poly1305(key, ivm)
}

function generateEphemeralKey() {
  let privKey
  do {
    privKey = randomBytes(32)
  } while (!privateKeyVerify(privKey))

  // get the public key in a compressed format
  const pubKey = publicKeyCreate(privKey)
  return { pubKey, privKey }
}

export function box_request(request: Envelope, exitNode: Identity): Result<Session> {

  return Result.err("not implemented")
}

export function unbox_request(request: Envelope, myId: Identity, lastTsOfThisClient: Date): Result<Session> {
  return Result.err("not implemented")
}

export function box_response(session: Session, response: Envelope): Result<void> {
  return Result.err("not implemented")
}

export function unbox_response(session: Session, response: Envelope, lastTsOfThisExitNode: Date): Result<void> {
  return Result.err("not implemented")
}