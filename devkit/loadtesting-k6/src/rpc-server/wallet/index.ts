import { Wallet, WalletTypes } from "../types.js";
import { MockDummyWallet } from "./dummy-wallet.js";
import { MockMetaMaskWallet } from "./metamask-wallet.js";
import { MockWallet } from "./mock-wallet.js";

export function buildWallet(walletType: WalletTypes, url?: string): MockWallet {
    switch (Wallet[walletType]) {
        case Wallet.METAMASK_ON_COW_SWAP:
            break;
        case Wallet.DUMMY:
            return new MockMetaMaskWallet(url);
        default:
            console.error("Cannot find the wallet name. Use dummy wallet")
            break;
    }
    return new MockDummyWallet(url);
}
