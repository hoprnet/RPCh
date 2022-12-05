import PeerId from "peer-id";
import { utils } from "ethers";
import { Identity as CryptoIdentity } from "rpch-crypto";

export class Identity {
  public readonly privKey?: Uint8Array;
  public readonly pubKey: Uint8Array;
  public readonly peerId: PeerId;

  constructor(peerId: string, privKey?: string) {
    this.peerId = PeerId.createFromB58String(peerId);
    this.pubKey = this.peerId.pubKey.bytes;
    this.privKey = privKey ? utils.arrayify(privKey) : undefined;
  }

  public getIdentity(): CryptoIdentity {
    return CryptoIdentity.load_identity(this.pubKey, this.privKey);
  }
}
