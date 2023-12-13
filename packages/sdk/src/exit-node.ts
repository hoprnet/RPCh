import * as utils from './utils';

export type ExitNode = {
    id: string;
    pubKey: string;
};

export function prettyPrint(peerId: string, version: string, counter: number, relays?: string[]) {
    const shortPid = utils.shortPeerId(peerId);
    const attrs = [`x${shortPid}`, `v${version}`, `c:${counter}`];
    if (relays) {
        attrs.push(`r:${relays.length}`);
    }
    return `ExitNode[${attrs.join(',')}]`;
}
