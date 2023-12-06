import * as utils from './utils';

export type ExitNode = {
    id: string;
    pubKey: string;
};

export function prettyPrint(peerId: string, version: string, counter: number, relays: string[]) {
    const shortPid = utils.shortPeerId(peerId);
    const relLength = relays.length;
    return `ExitNode[x${shortPid},v${version},c:${counter},r:${relLength}]`;
}
