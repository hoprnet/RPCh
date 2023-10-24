import { Wallet, WalletTypes } from "../types.js";
import { MockDummyWallet } from "./dummy-wallet.js";
import { MockWallet } from "./mock-wallet.js";

export function buildWallet(walletType: WalletTypes, url?: string): MockWallet {
    switch (Wallet[walletType]) {
        case Wallet.DUMMY_SMALL:
        break;
        default:
        break;
    }
    return new MockDummyWallet(url);
}
