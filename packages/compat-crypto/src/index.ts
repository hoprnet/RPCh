import { hash_length, extract, expand } from 'futoin-hkdf';
import { chacha20poly1305 } from '@noble/ciphers/chacha';
import { randomBytes } from 'crypto';
import { ecdh, privateKeyVerify, publicKeyCreate } from 'secp256k1';

/// Represents a request-response session.
export type Session = {
    request?: Uint8Array;
    response?: Uint8Array;
    updatedTS: bigint;
    sharedPreSecret?: Uint8Array;
};

export type ResSuccess = { isErr: false; session: Session };
export type ResError = { isErr: true; message: string; session?: Session };
export type Result = ResSuccess | ResError;

/// RPCh Crypto protocol version
export const RPCH_CRYPTO_VERSION = 0x12;

/// Tolerance a timestamp could be over lower or upper bound
const TIMESTAMP_TOLERANCE_MS = 30_000;

/// Encoded public key size |W|
const PUBLIC_KEY_SIZE_ENCODED = 33;
/// Length of the counter |C|
const COUNTER_LEN = 8;

/// Length of the authentication tag |T|
const AUTH_TAG_LEN = 16;

const CIPHER_KEY_LEN = 32;
const CIPHER_IV_LEN = 12;

const BLAKE2S256_HASH = 'blake2s256';
const REQUEST_TAG = 'req';
const RESPONSE_TAG = 'resp';

function initializeCipher(
    sharedPreSecret: Uint8Array,
    counter: bigint,
    peerId: string,
    request: boolean
) {
    const startIndex = request ? 0 : 2;
    const saltTag = request ? REQUEST_TAG : RESPONSE_TAG;

    // Construct salt for the HKDF
    const salt = Buffer.alloc(1 + peerId.length + saltTag.length);
    salt.writeUint8(RPCH_CRYPTO_VERSION);
    salt.write(peerId, 1); // utf8 encoded
    salt.write(saltTag, peerId.length + 1);

    // Generate key material for expansion
    const hashLen = hash_length(BLAKE2S256_HASH);
    const prk = extract(BLAKE2S256_HASH, hashLen, Buffer.from(sharedPreSecret), Buffer.from(salt));

    const cipherKeyLen = CIPHER_KEY_LEN;
    const idx = new Uint8Array(1);

    // First key material expansion for symmetric key
    idx[0] = startIndex;
    const key = expand(BLAKE2S256_HASH, hashLen, prk, cipherKeyLen, Buffer.from(idx));

    // Second key material expansion for IV prefix
    idx[0] = startIndex + 1;
    const prefixLen = CIPHER_IV_LEN - COUNTER_LEN;
    const iv_prefix = expand(BLAKE2S256_HASH, hashLen, prk, prefixLen, Buffer.from(idx));

    // Concatenate the prefix with the counter to form the IV
    const iv = Buffer.alloc(CIPHER_IV_LEN);
    iv_prefix.copy(iv);
    iv.writeBigUint64BE(counter, prefixLen);

    // Initialize Chacha20 with Poly1305
    return chacha20poly1305(key, iv);
}

/// Generates a random secp256k1 keypair
function generateEphemeralKey(randomFn: (len: number) => Uint8Array) {
    let privKey;
    do {
        privKey = randomFn(32);
    } while (!privateKeyVerify(privKey));

    const pubKey = publicKeyCreate(privKey);
    if (pubKey.length !== PUBLIC_KEY_SIZE_ENCODED) {
        throw new Error('key size mismatch');
    }

    return { pubKey, privKey };
}

/// Extracts the X coordinate from the ECDH result
function getXCoord(x: Uint8Array, _: Uint8Array) {
    return new Uint8Array(x);
}

/// Validates that (lowerBound - tolerance) <= value <= (upperBound + tolerance)
function validateTS(value: bigint, lowerBound: bigint, upperBound: bigint) {
    if (lowerBound >= upperBound) {
        return false;
    }

    const lowerDiff = lowerBound - value;
    const upperDiff = value - upperBound;

    // if `value` < `lowerBound` it must be within tolerance
    // if `value` > `upperBound` it must be within tolerance
    return lowerDiff <= TIMESTAMP_TOLERANCE_MS && upperDiff <= TIMESTAMP_TOLERANCE_MS;
}

/// Called by the RPCh client
/// Takes enveloped request data, the public key of the RPCh Exit Node and Request counter for such
/// RPCh Exit node and then encrypts and authenticates the data.
/// The encrypted data and new counter value to be persisted is returned in the resulting session.
export function boxRequest(
    {
        message,
        exitPeerId,
        exitPublicKey,
    }: { message: Uint8Array; exitPeerId: string; exitPublicKey: Uint8Array },
    randomFn: (len: number) => Uint8Array = randomBytes
): Result {
    if (exitPublicKey.length !== PUBLIC_KEY_SIZE_ENCODED) {
        return { isErr: true, message: 'incorrect public key size' };
    }

    let ephemeralKey;
    let sharedPreSecret;
    try {
        ephemeralKey = generateEphemeralKey(randomFn);
        sharedPreSecret = ecdh(
            exitPublicKey,
            ephemeralKey.privKey,
            { hashfn: getXCoord },
            Buffer.alloc(PUBLIC_KEY_SIZE_ENCODED - 1)
        );
    } catch (err) {
        return {
            isErr: true,
            message: `ecdh failed ${err}`,
        };
    }

    const newCounter = BigInt(Date.now() + 1);

    let cipher;
    try {
        cipher = initializeCipher(sharedPreSecret, newCounter, exitPeerId, true);
    } catch (err) {
        return {
            isErr: true,
            message: `failed to initialize cipher: ${err}`,
        };
    }

    let cipherText;
    try {
        cipherText = cipher.encrypt(message);
    } catch (err) {
        return {
            isErr: true,
            message: `failed to encrypt data: ${err}`,
        };
    }

    const counterBuf = Buffer.alloc(COUNTER_LEN);
    counterBuf.writeBigUint64BE(newCounter);

    const versionBuf = Buffer.alloc(1);
    versionBuf.writeUint8(RPCH_CRYPTO_VERSION);

    // V,W,C,R,T
    const result = Buffer.concat([
        versionBuf,
        ephemeralKey.pubKey,
        counterBuf,
        Buffer.from(cipherText),
    ]);

    return {
        isErr: false,
        session: {
            request: new Uint8Array(result),
            updatedTS: newCounter,
            sharedPreSecret,
        },
    };
}

/// Called by the RPCh Exit Node
/// Takes enveloped encrypted data, the private key of the RPCh Exit Node and Request counter for
/// RPCh Client node associated with the request and then decrypts and verifies the data.
/// The decrypted data and new counter value to be persisted is returned in the resulting session.
/// Returns error and session if count verifcation failed so a response with the error message can still be boxed.
export function unboxRequest(
    {
        message,
        exitPeerId,
        exitPrivateKey,
    }: { message: Uint8Array; exitPeerId: string; exitPrivateKey: Uint8Array },
    lastTsOfThisClient: Date
): Result {
    if ((message[0] & 0x10) != (RPCH_CRYPTO_VERSION & 0x10)) {
        return {
            isErr: true,
            message: 'unsupported protocol version',
        };
    }

    if (message.length <= 1 + PUBLIC_KEY_SIZE_ENCODED + COUNTER_LEN + AUTH_TAG_LEN) {
        return {
            isErr: true,
            message: 'invalid message size',
        };
    }

    if (!exitPrivateKey) {
        return {
            isErr: true,
            message: 'missing private key',
        };
    }

    let sharedPreSecret;
    try {
        const ephemeralPk = message.slice(1, PUBLIC_KEY_SIZE_ENCODED + 1);
        sharedPreSecret = ecdh(
            ephemeralPk,
            exitPrivateKey,
            { hashfn: getXCoord },
            Buffer.alloc(PUBLIC_KEY_SIZE_ENCODED - 1)
        );
    } catch (err) {
        return {
            isErr: true,
            message: `ecdh failed: ${err}`,
        };
    }

    const counter = Buffer.from(message).readBigUint64BE(1 + PUBLIC_KEY_SIZE_ENCODED);

    let cipher;
    try {
        cipher = initializeCipher(sharedPreSecret, counter, exitPeerId, true);
    } catch (err) {
        return {
            isErr: true,
            message: `failed to initialize cipher: ${err}`,
        };
    }

    let plaintext;
    try {
        plaintext = cipher.decrypt(message.slice(1 + PUBLIC_KEY_SIZE_ENCODED + COUNTER_LEN));
    } catch (err) {
        return {
            isErr: true,
            message: `decryption failed: ${err}`,
        };
    }

    const session = {
        request: plaintext,
        updatedTS: counter,
        sharedPreSecret,
    };

    if (!validateTS(counter, BigInt(lastTsOfThisClient.getTime()), BigInt(Date.now()))) {
        return {
            isErr: true,
            message: 'ts verification failed',
            session,
        };
    }

    return {
        isErr: false,
        session,
    };
}

/// Called by the RPCh Exit Node
/// Takes enveloped response data, the request session obtained by unboxRequest and Response counter for the associated
/// RPCh Client node and then encrypts and authenticates the data.
/// The encrypted data and new counter value to be persisted is returned in the resulting session.
export function boxResponse(
    session: Session,
    { entryPeerId, message }: { entryPeerId: string; message: Uint8Array }
): Result {
    const sharedPreSecret = session.sharedPreSecret;
    if (!sharedPreSecret) {
        return {
            isErr: true,
            message: 'invalid session',
        };
    }

    const newCounter = BigInt(Date.now() + 1);

    let cipher;
    try {
        cipher = initializeCipher(sharedPreSecret, newCounter, entryPeerId, false);
    } catch (err) {
        return {
            isErr: true,
            message: `failed to initialize cipher: ${err}`,
        };
    }

    let cipherText;
    try {
        cipherText = cipher.encrypt(message);
    } catch (err) {
        return {
            isErr: true,
            message: `failed to encrypt data: ${err}`,
        };
    }

    const counterBuf = Buffer.alloc(COUNTER_LEN);
    counterBuf.writeBigUint64BE(newCounter);

    const versionBuf = Buffer.alloc(1);
    versionBuf.writeUint8(RPCH_CRYPTO_VERSION);

    // C,R,T
    const result = Buffer.concat([counterBuf, Buffer.from(cipherText)]);
    session.response = new Uint8Array(result);
    session.updatedTS = newCounter;

    return {
        isErr: false,
        session,
    };
}

/// Called by the RPCh Client Node
/// Takes enveloped encrypted data, the associated session returned by boxRequest and Request counter for
/// RPCh Exit node associated with the response and then decrypts and verifies the data.
/// The decrypted data and new counter value to be persisted is returned in the resulting session.
export function unboxResponse(
    session: Session,
    { entryPeerId, message }: { entryPeerId: string; message: Uint8Array },
    lastTsOfThisExitNode: Date
): Result {
    const sharedPreSecret = session.sharedPreSecret;
    if (!sharedPreSecret) {
        return {
            isErr: true,
            message: 'invalid session',
        };
    }

    if (message.length <= COUNTER_LEN + AUTH_TAG_LEN) {
        return {
            isErr: true,
            message: 'invalid message size',
        };
    }

    const counter = Buffer.from(message).readBigUint64BE();

    let cipher;
    try {
        cipher = initializeCipher(sharedPreSecret, counter, entryPeerId, false);
    } catch (err) {
        return {
            isErr: true,
            message: `failed to initialize cipher: ${err}`,
        };
    }

    let plaintext;
    try {
        plaintext = cipher.decrypt(message.slice(COUNTER_LEN));
    } catch (err) {
        return {
            isErr: true,
            message: `decryption failed: ${err}`,
        };
    }

    if (!validateTS(counter, BigInt(lastTsOfThisExitNode.getTime()), BigInt(Date.now()))) {
        return {
            isErr: true,
            message: 'ts verification failed',
        };
    }

    session.response = plaintext;
    session.updatedTS = counter;

    return {
        isErr: false,
        session,
    };
}

export function isError(res: Result): res is ResError {
    return res.isErr;
}
