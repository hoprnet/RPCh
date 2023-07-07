export function shortPeerId(peerId: string): string {
  return `p..${peerId.substring(peerId.length - 4)}`;
}
