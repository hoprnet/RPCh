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
  constructor(public publicKey: Uint8Array, public privateKey?: Uint8Array) {}
}

export type Session = {
  request?: Uint8Array,
  response?: Uint8Array,
  updatedTS: Date,
  sharedPresecret: Uint8Array
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

const RPCH_CRYPTO_VERSION = 0x12;

const TIMESTAMP_TOLERANCE_MS = 30_000; // milliseconds
const PUBLIC_KEY_SIZE_ENCODED = 33;
const CIPHER_KEY_LEN = 32;
const CIPHER_IV_LEN = 12;
const COUNTER_LEN = 4;
const BLAKE2S256_HASH = 'blake2s256'
const REQUEST_TAG = 'req'
const RESPONSE_TAG = 'resp'

function initializeCipher(sharedPreSecret: Uint8Array, counter: number, salt: Uint8Array, startIndex: number) {
  const hashLen = hash_length(BLAKE2S256_HASH);
  const prk = extract(BLAKE2S256_HASH, hashLen, Buffer.from(sharedPreSecret), Buffer.from(salt))

  const cipherKeyLen = CIPHER_KEY_LEN;
  const cipherIvLen = CIPHER_IV_LEN - COUNTER_LEN;
  const idx = new Uint8Array(1);

  idx[0] = startIndex;
  const key = expand(BLAKE2S256_HASH, hashLen, prk, cipherKeyLen, Buffer.from(idx))
  idx[0] = startIndex + 1;
  const ivm = expand(BLAKE2S256_HASH, hashLen, prk, cipherIvLen, Buffer.from(idx))

  let iv = new Buffer(CIPHER_IV_LEN)
  iv.copy(iv)
  iv.writeUint32BE(counter, cipherIvLen)

  return chacha20poly1305(key, iv)
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

function getXCoord(x: any, y: any) {
  const pubKey = new Uint8Array(33)
  pubKey[0] = (y[31] & 1) === 0 ? 0x02 : 0x03
  pubKey.set(x, 1)
  return pubKey
}

export function box_request(request: Envelope, exitNode: Identity): Result<Session> {
  const ephemeralKey = generateEphemeralKey()
  const sharedPreSecret = ecdh(exitNode.publicKey, ephemeralKey.privKey, { hashfn: getXCoord })

  const newCounter = Date.now() + 1
  let cipher

  try {
    const salt = new Buffer(1 + request.exitPeerId.length + REQUEST_TAG.length)
    salt.writeUint8(RPCH_CRYPTO_VERSION)
    salt.write(request.exitPeerId, 'ascii')
    salt.write(REQUEST_TAG, 'ascii')

    cipher = initializeCipher(sharedPreSecret, newCounter, salt, 0)
  }
  catch (err) {
    return Result.err(`failed to initialize cipher: ${err}`)
  }

  let cipherText;
  try {
    cipherText = cipher.encrypt(request.message)
  }
  catch (err) {
    return Result.err(`failed to encrypt Envelope data: ${err}`)
  }

  const counterBuf = new Buffer(COUNTER_LEN)
  counterBuf.writeUint32BE(newCounter)

  const versionBuf = new Buffer(1)
  versionBuf.writeUint8(RPCH_CRYPTO_VERSION)

  let result = Buffer.concat([versionBuf, ephemeralKey.pubKey, counterBuf, Buffer.from(cipherText)])


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