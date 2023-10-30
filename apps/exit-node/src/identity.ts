import crypto from 'crypto';
import fs from 'fs';
import { Wallet, utils as ethersUtils } from 'ethers';

const generateIv = () => crypto.randomBytes(16);
const getSalt = (str: string): Buffer => crypto.scryptSync(str, 'salt', 24);

export type ID = {
    privateKey: string;
    publicKey: string;
};

/**
 * Generates a random private key.
 * @returns random private key
 */
export const createPrivateKey = async (): Promise<Uint8Array> => {
    return ethersUtils.arrayify(Wallet.createRandom().privateKey);
};

/**
 * Encrypts and stores the private key.
 * @param privateKey private key to store
 * @param password password to encrypt private key before storing
 * @param file where to store the encrypted content
 * @returns a Uint8Array of [iv, encryptedPrivateKey]
 */
export const storePrivateKey = async (
    privateKey: Uint8Array,
    password: string,
    file: string,
): Promise<Uint8Array> => {
    const key = getSalt(password);
    const iv = generateIv();
    const cipher = crypto.createCipheriv('aes-192-cbc', key, iv);
    const encrypted = Buffer.concat([cipher.update(privateKey), cipher.final()]);
    // include IV into file
    const result = Buffer.concat([iv, encrypted]);
    await fs.promises.writeFile(file, result, 'hex');
    return Uint8Array.from(result);
};

/**
 * Loads and decrypts the private key.
 * @param password password to decrypt private key
 * @param file where our encrypted private key is located
 * @returns
 */
export const loadPrivateKey = async (
    password: string,
    file: string,
): Promise<Uint8Array | undefined> => {
    let blob: Buffer;
    try {
        blob = await fs.promises.readFile(file);
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return undefined;
        } else {
            throw error;
        }
    }

    const key = getSalt(password);
    // split IV and encrypted content
    const [iv, encrypted] = [blob.subarray(0, 16), blob.subarray(16, blob.byteLength)];
    const decipher = crypto.createDecipheriv('aes-192-cbc', key, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return Uint8Array.from(decrypted);
};

/**
 *
 * @param data
 * @returns Identity
 */
export const getIdentity = async ({
    identityFile,
    privateKey,
    password,
}: {
    privateKey?: Uint8Array;
    identityFile: string;
    password?: string;
}): Promise<ID> => {
    if (!privateKey && !password) {
        throw Error("Should provide 'privateKey' or 'password'");
    } else if (!privateKey && password) {
        // search for private key in storage
        privateKey = await loadPrivateKey(password, identityFile);
        if (!privateKey) {
            // if not found create a new one
            privateKey = await createPrivateKey();
            // store it in storage
            await storePrivateKey(privateKey, password, identityFile);
        }
    }

    const wallet = new Wallet(privateKey!);
    const publicKey = ethersUtils.computePublicKey(wallet.publicKey, true);

    return {
        privateKey: wallet.privateKey,
        publicKey,
    };
};
