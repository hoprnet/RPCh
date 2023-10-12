import { hash_length, extract, expand } from 'futoin-hkdf'
import { chacha20poly1305 } from '@noble/ciphers/chacha'
import { randomBytes } from 'crypto'
import assert from 'assert'
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

export type Result = {
  isErr: boolean
  session?: Session
  message?: string
}

/// RPCh Crypto protocol version
export const RPCH_CRYPTO_VERSION = 0x12;

/// Tolerance a timestamp could be over lower or upper bound
const TIMESTAMP_TOLERANCE_SEC = 30;

/// Encoded public key size |W|
const PUBLIC_KEY_SIZE_ENCODED = 33;
/// Length of the counter |C|
const COUNTER_LEN = 4;

/// Length of the authentication tag |T|
const AUTH_TAG_LEN = 16

const CIPHER_KEY_LEN = 32;
const CIPHER_IV_LEN = 12;

const BLAKE2S256_HASH = 'blake2s256'
const REQUEST_TAG = 'req'
const RESPONSE_TAG = 'resp'

function initializeCipher(sharedPreSecret: Uint8Array, counter: number,peerId: string, request: boolean) {
  const startIndex = request ? 0 : 2
  const saltTag = request ? REQUEST_TAG : RESPONSE_TAG

  // Construct salt for the HKDF
  const salt = Buffer.alloc(1 + peerId.length + saltTag.length)
  salt.writeUint8(RPCH_CRYPTO_VERSION)
  salt.write(peerId) // utf8 encoded
  salt.write(saltTag)

  // Generate key material for expansion
  const hashLen = hash_length(BLAKE2S256_HASH);
  const prk = extract(BLAKE2S256_HASH, hashLen, Buffer.from(sharedPreSecret), Buffer.from(salt))

  const cipherKeyLen = CIPHER_KEY_LEN;
  const idx = new Uint8Array(1);

  // First key material expansion for symmetric key
  idx[0] = startIndex;
  const key = expand(BLAKE2S256_HASH, hashLen, prk, cipherKeyLen, Buffer.from(idx))

  // Second key material expansion for IV prefix
  idx[0] = startIndex + 1;
  const iv_prefix = expand(BLAKE2S256_HASH, hashLen, prk, CIPHER_IV_LEN - COUNTER_LEN, Buffer.from(idx))

  // Concatenate the prefix with the counter to form the IV
  let iv = Buffer.alloc(CIPHER_IV_LEN)
  iv_prefix.copy(iv)
  iv.writeUint32BE(counter, CIPHER_IV_LEN - COUNTER_LEN)

  // Initialize Chacha20 with Poly1305
  return chacha20poly1305(key, iv)
}

/// Generates a random secp256k1 keypair
function generateEphemeralKey() {
  let privKey
  do {
    privKey = randomBytes(32)
  } while (!privateKeyVerify(privKey))

  const pubKey = publicKeyCreate(privKey)
  assert(pubKey.length == PUBLIC_KEY_SIZE_ENCODED)

  return { pubKey, privKey }
}

/// Extracts the X coordinate from the ECDH result
function getXCoord(x: any, y: any) {
  const pubKey = new Uint8Array(33)
  pubKey[0] = (y[31] & 1) === 0 ? 0x02 : 0x03
  pubKey.set(x, 1)
  return pubKey
}

/// Validates that (lowerBound - tolerance) <= value <= (upperBound + tolerance)
function validateTS(value: number, lowerBound: number, upperBound: number) {
  assert(lowerBound < upperBound)

  let lowerDiff = lowerBound - value
  let upperDiff = value - upperBound

  // if `value` < `lowerBound` it must be within tolerance
  // if `value` > `upperBound` it must be within tolerance
  return lowerDiff <= TIMESTAMP_TOLERANCE_SEC && upperDiff <= TIMESTAMP_TOLERANCE_SEC
}

/// Called by the RPCh client
/// Takes enveloped request data, the identity of the RPCh Exit Node and Request counter for such
/// RPCh Exit node and then encrypts and authenticates the data.
/// The encrypted data and new counter value to be persisted is returned in the resulting session.
export function box_request(request: Envelope, exitNode: Identity): Result {
  assert(exitNode.publicKey.length == PUBLIC_KEY_SIZE_ENCODED, 'incorrect public key size')

  let ephemeralKey
  let sharedPreSecret
  try {
    ephemeralKey = generateEphemeralKey()
    sharedPreSecret = ecdh(exitNode.publicKey, ephemeralKey.privKey, { hashfn: getXCoord })
  }
  catch (err) {
    return {
      isErr: true,
      message: `ecdh failed ${err}`
    }
  }

  const newCounter = (Date.now() + 1) / 1000

  let cipher
  try {
    cipher = initializeCipher(sharedPreSecret, newCounter, request.exitPeerId, true)
  }
  catch (err) {
    return {
      isErr: true,
      message: `failed to initialize cipher: ${err}`
    }
  }

  let cipherText
  try {
    cipherText = cipher.encrypt(request.message)
  }
  catch (err) {
    return {
      isErr: true,
      message: `failed to encrypt data: ${err}`
    }
  }

  const counterBuf = Buffer.alloc(COUNTER_LEN)
  counterBuf.writeUint32BE(newCounter)

  const versionBuf = Buffer.alloc(1)
  versionBuf.writeUint8(RPCH_CRYPTO_VERSION)

  // V,W,C,R,T
  let result = Buffer.concat([versionBuf, ephemeralKey.pubKey, counterBuf, Buffer.from(cipherText)])

  return {
    isErr: false,
    session: {
      request: new Uint8Array(result),
      updatedTS: new Date(newCounter * 1000),
      sharedPreSecret
    }
  }
}

/// Called by the RPCh Exit Node
/// Takes enveloped encrypted data, the local identity of the RPCh Exit Node and Request counter for
/// RPCh Client node associated with the request and then decrypts and verifies the data.
/// The decrypted data and new counter value to be persisted is returned in the resulting session.
export function unbox_request(request: Envelope, myId: Identity, lastTsOfThisClient: Date): Result {
  const message = request.message
  if ((message[0] & 0x10) != (RPCH_CRYPTO_VERSION & 0x10)) {
    return {
      isErr: true,
      message: 'unsupported protocol version'
    }
  }

  if (message.length <= 1 + PUBLIC_KEY_SIZE_ENCODED + COUNTER_LEN + AUTH_TAG_LEN) {
    return {
      isErr: true,
      message: 'invalid message size'
    }
  }

  if (!myId.privateKey) {
    return {
      isErr: true,
      message: 'missing identity private key'
    }
  }

  let sharedPreSecret
  try {
    let ephemeralPk = message.slice(1, PUBLIC_KEY_SIZE_ENCODED)
    sharedPreSecret = ecdh(ephemeralPk, myId.privateKey, { hashfn: getXCoord })
  }
  catch (err) {
    return {
      isErr: true,
      message: `ecdh failed: ${err}`
    }
  }

  const counter = Buffer.from(message).readUint32BE(1 + PUBLIC_KEY_SIZE_ENCODED)

  let cipher
  try {
    cipher = initializeCipher(sharedPreSecret, counter, request.exitPeerId, true)
  }
  catch (err) {
    return {
      isErr: true,
      message: `failed to initialize cipher: ${err}`
    }
  }

  let plaintext
  try {
    plaintext = cipher.decrypt(message.slice(1 + PUBLIC_KEY_SIZE_ENCODED + COUNTER_LEN))
  }
  catch (err) {
    return {
      isErr: true,
      message: `decryption failed: ${err}`
    }
  }

  if (!validateTS(counter, lastTsOfThisClient.getTime()/1000, Date.now()/1000)) {
    return {
      isErr: true,
      message: 'ts verification failed'
    }
  }

  return {
    isErr: false,
    session: {
      request: plaintext,
      updatedTS: new Date(counter * 1000),
      sharedPreSecret
    }
  }
}

/// Called by the RPCh Exit Node
/// Takes enveloped response data, the request session obtained by unbox_request and Response counter for the associated
/// RPCh Client node and then encrypts and authenticates the data.
/// The encrypted data and new counter value to be persisted is returned in the resulting session.
export function box_response(session: Session, response: Envelope): Result {
  const sharedPreSecret = session.sharedPreSecret
  if (!sharedPreSecret) {
    return {
      isErr: true,
      message: 'invalid session'
    }
  }

  const newCounter = (Date.now() + 1) / 1000

  let cipher
  try {
    cipher = initializeCipher(sharedPreSecret, newCounter, response.entryPeerId, false)
  }
  catch (err) {
    return {
      isErr: true,
      message: `failed to initialize cipher: ${err}`
    }
  }

  let cipherText
  try {
    cipherText = cipher.encrypt(response.message)
  }
  catch (err) {
    return {
      isErr: true,
      message: `failed to encrypt data: ${err}`
    }
  }

  const counterBuf = Buffer.alloc(COUNTER_LEN)
  counterBuf.writeUint32BE(newCounter)

  const versionBuf = Buffer.alloc(1)
  versionBuf.writeUint8(RPCH_CRYPTO_VERSION)

  // V,C,R,T
  let result = Buffer.concat([versionBuf, counterBuf, Buffer.from(cipherText)])
  session.response = new Uint8Array(result)
  session.updatedTS = new Date(newCounter * 1000)

  return {
    isErr: false
  }
}

/// Called by the RPCh Client Node
/// Takes enveloped encrypted data, the associated session returned by box_request and Request counter for
/// RPCh Exit node associated with the response and then decrypts and verifies the data.
/// The decrypted data and new counter value to be persisted is returned in the resulting session.
export function unbox_response(session: Session, response: Envelope, lastTsOfThisExitNode: Date): Result {
  let sharedPreSecret = session.sharedPreSecret
  if (!sharedPreSecret) {
    return {
      isErr: true,
      message: 'invalid session'
    }
  }

  const message = response.message
  if ((message[0] & 0x10) != (RPCH_CRYPTO_VERSION & 0x10)) {
    return {
      isErr: true,
      message: 'unsupported protocol version'
    }
  }

  if (message.length <= 1 + COUNTER_LEN + AUTH_TAG_LEN) {
    return {
      isErr: true,
      message: 'invalid message size'
    }
  }

  const counter = Buffer.from(message).readUint32BE(1 + PUBLIC_KEY_SIZE_ENCODED)

  let cipher
  try {
    cipher = initializeCipher(sharedPreSecret, counter, response.entryPeerId, false)
  }
  catch (err) {
    return {
      isErr: true,
      message: `failed to initialize cipher: ${err}`
    }
  }

  let plaintext
  try {
    plaintext = cipher.decrypt(message.slice(1 + COUNTER_LEN))
  }
  catch (err) {
    return {
      isErr: true,
      message: `decryption failed: ${err}`
    }
  }

  if (!validateTS(counter, lastTsOfThisExitNode.getTime()/1000, Date.now()/1000)) {
    return {
      isErr: true,
      message: 'ts verification failed'
    }
  }

  session.response = plaintext;
  session.updatedTS = new Date(counter * 1000)

  return {
    isErr: false
  }
}