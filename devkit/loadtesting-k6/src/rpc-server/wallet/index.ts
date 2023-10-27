import { Wallet, WalletTypes } from "../types.js";
import { MockRabbyWallet } from "./rabby-wallet.js";
import { MockDummyWallet } from "./dummy-wallet.js";
import { MockFrameWallet } from "./frame-wallet.js";
import { MockMetaMaskWallet } from "./metamask-wallet.js";
import { MockWallet } from "./mock-wallet.js";
import { MockOkxWallet } from "./okx-wallet.js";

export function buildWallet(walletType: WalletTypes, url?: string): MockWallet {
    switch (Wallet[walletType]) {
        case Wallet.METAMASK:
            return new MockMetaMaskWallet(url);
        case Wallet.OKX:
            return new MockOkxWallet(url);
        case Wallet.RABBY:
            return new MockRabbyWallet(url);
        case Wallet.FRAME:
            return new MockFrameWallet(url);
        case Wallet.DUMMY:
        default:
            console.error(`Cannot find the wallet name ${walletType}. Use dummy wallet`)
            break;
    }
    return new MockDummyWallet(url);
}
