import { utils } from "@rpch/common";

export const createLogger = utils.LoggerFactory("sdk");

export function shortPeerId(peerId: string): string {
  return `.${peerId.substring(peerId.length - 4)}`;
}

export function randomEl<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function average(arr: number[]): number {
  const sum = arr.reduce((acc, l) => acc + l, 0);
  return sum / arr.length || 0;
}

export function isValidURL(url: string) {
  if ("canParse" in URL) {
    // @ts-ignore
    return URL.canParse(url);
  }
  try {
    new URL(url);
    return true;
  } catch (_ex) {
    return false;
  }
}
