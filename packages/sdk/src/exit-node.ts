import * as utils from './utils';

export type ExitNode = {
    id: string;
    pubKey: string;
};

export function prettyPrint(peerId: string, version: string, counter: number) {
    const shortPid = utils.shortPeerId(peerId);
    return `ExitNode[${shortPid}(${peerId}),v${version},c:${counter}]`;
}
