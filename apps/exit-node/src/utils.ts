import { utils } from "ethers";
import secp256k1 from "secp256k1";
import PeerId from "peer-id";

/**
 * Converts a plain compressed ECDSA private key string over
 * the curve `secp256k1` to a PeerId.
 * @param privKeyStr the plain private key in hex-string format
 */
export async function privKeyStrToPeerId(privKeyStr: string): Promise<PeerId> {
  const keys = (await import("@libp2p/crypto")).keys;
  const matched = privKeyStr.match(/(?<=^0x|^)[0-9a-fA-F]{64}/);
  if (!matched) {
    throw Error(
      `Invalid input argument. Either key length or key characters were incorrect.`
    );
  }
  const privKey = utils.arrayify(privKeyStr);
  const secp256k1PrivKey = new keys.supportedKeys.secp256k1.Secp256k1PrivateKey(
    privKey,
    secp256k1.publicKeyCreate(privKey)
  );
  return PeerId.createFromPrivKey(secp256k1PrivKey.bytes);
}
