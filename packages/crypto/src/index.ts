import { hash_length, extract, expand } from 'futoin-hkdf'
import { chacha20poly1305 } from '@noble/ciphers/chacha'
import { randomBytes } from 'crypto'
import {
  ecdh,
  privateKeyVerify,
  publicKeyCreate
} from 'secp256k1'
import assert from "assert";


export type Envelope = {
  message: Uint8Array,
  entryPeerId: string,
  exitPeerId: string,
}

export type Identity = {
  publicKey: Uint8Array,
  privateKey?: Uint8Array
}

export type Session = {
  request?: Uint8Array,
  response?: Uint8Array,
  updatedTS: Date,
  sharedPreSecret?: Uint8Array
}

export class Result<T> {
  constructor(public readonly ok: T | undefined, public readonly error: string, public readonly is_err: boolean) {}
  public static ok<T>(res: T) {
    return new Result<T>(res, "", false)
  }
  public static err<T>(err: string) {
    return new Result<T>(undefined, err, true)
  }
}

const RPCH_CRYPTO_VERSION = 0x12;

const TIMESTAMP_TOLERANCE_SEC = 30;
const PUBLIC_KEY_SIZE_ENCODED = 33;

const CIPHER_KEY_LEN = 32;
const CIPHER_IV_LEN = 12;
const COUNTER_LEN = 4;
const CIPHER_AUTH_TAG_LEN = 16

const BLAKE2S256_HASH = 'blake2s256'
const REQUEST_TAG = 'req'
const RESPONSE_TAG = 'resp'

function initializeCipher(sharedPreSecret: Uint8Array, counter: number, salt: Uint8Array, startIndex: number) {
  const hashLen = hash_length(BLAKE2S256_HASH);
  const prk = extract(BLAKE2S256_HASH, hashLen, Buffer.from(sharedPreSecret), Buffer.from(salt))

  const cipherKeyLen = CIPHER_KEY_LEN;
  const idx = new Uint8Array(1);

  idx[0] = startIndex;
  const key = expand(BLAKE2S256_HASH, hashLen, prk, cipherKeyLen, Buffer.from(idx))
  idx[0] = startIndex + 1;
  const ivm = expand(BLAKE2S256_HASH, hashLen, prk, CIPHER_IV_LEN - COUNTER_LEN, Buffer.from(idx))

  let iv = Buffer.alloc(CIPHER_IV_LEN)
  ivm.copy(iv)
  iv.writeUint32BE(counter, CIPHER_IV_LEN - COUNTER_LEN)

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

function validateTS(value: number, lowerBound: number, upperBound: number) {
  assert(lowerBound < upperBound)

  let lowerDiff = lowerBound - value
  let upperDiff = value - upperBound

  // if `value` < `lowerBound` it must be within tolerance
  // if `value` > `upperBound` it must be within tolerance
  return lowerDiff <= TIMESTAMP_TOLERANCE_SEC && upperDiff <= TIMESTAMP_TOLERANCE_SEC
}

export function box_request(request: Envelope, exitNode: Identity): Result<Session> {
  const ephemeralKey = generateEphemeralKey()
  const sharedPreSecret = ecdh(exitNode.publicKey, ephemeralKey.privKey, { hashfn: getXCoord })

  const newCounter = (Date.now() + 1) / 1000
  let cipher

  try {
    const salt = Buffer.alloc(1 + request.exitPeerId.length + REQUEST_TAG.length)
    salt.writeUint8(RPCH_CRYPTO_VERSION)
    salt.write(request.exitPeerId) // utf8 encoded
    salt.write(REQUEST_TAG)

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

  const counterBuf = Buffer.alloc(COUNTER_LEN)
  counterBuf.writeUint32BE(newCounter)

  const versionBuf = Buffer.alloc(1)
  versionBuf.writeUint8(RPCH_CRYPTO_VERSION)

  let result = Buffer.concat([versionBuf, ephemeralKey.pubKey, counterBuf, Buffer.from(cipherText)])
  let session: Session = {
    request: new Uint8Array(result),
    updatedTS: new Date(newCounter * 1000),
    sharedPreSecret
  }

  return Result.ok(session)
}

export function unbox_request(request: Envelope, myId: Identity, lastTsOfThisClient: Date): Result<Session> {
  const message = request.message
  if ((message[0] & 0x10) != (RPCH_CRYPTO_VERSION & 0x10)) {
    return Result.err("unsupported protocol version")
  }

  if (message.length <= 1 + PUBLIC_KEY_SIZE_ENCODED + COUNTER_LEN + CIPHER_AUTH_TAG_LEN) {
    return Result.err("invalid message size")
  }

  if (!myId.privateKey) {
    return Result.err("missing identity private key")
  }

  let ephemeralPk = request.message.slice(1, PUBLIC_KEY_SIZE_ENCODED)
  let sharedPreSecret = ecdh(ephemeralPk, myId.privateKey, { hashfn: getXCoord })
  let counter = Buffer.from(request.message).readUint32BE(1 + PUBLIC_KEY_SIZE_ENCODED)

  let cipher;
  try {
    const salt = Buffer.alloc(1 + request.exitPeerId.length + REQUEST_TAG.length)
    salt.writeUint8(RPCH_CRYPTO_VERSION)
    salt.write(request.exitPeerId) // utf8 encoded
    salt.write(REQUEST_TAG)

    cipher = initializeCipher(sharedPreSecret, counter, salt, 0)
  }
  catch (err) {
    return Result.err(`failed to initialize cipher: ${err}`)
  }

  let plaintext
  try {
    plaintext = cipher.decrypt(message.slice(1 + PUBLIC_KEY_SIZE_ENCODED + COUNTER_LEN))
  }
  catch (err) {
    return Result.err(`decryption failed: ${err}`)
  }

  if (!validateTS(counter, lastTsOfThisClient.getTime()/1000, Date.now()/1000)) {
    return Result.err("ts verification failed")
  }

  let ret: Session = {
    request: plaintext,
    updatedTS: new Date(counter * 1000),
    sharedPreSecret
  }

  return Result.ok(ret)
}

export function box_response(session: Session, response: Envelope): Result<void> {
  return Result.err("not implemented")
}

export function unbox_response(session: Session, response: Envelope, lastTsOfThisExitNode: Date): Result<void> {
  return Result.err("not implemented")
}