import * as Res from './result';

// Maximum bytes we should be sending within the HOPR network.
const MaxBytes = 400;
// Maximum segment overhead is 17 bytes, could be as little as 13 though (e.g. `4|999999|999|999|` vs `4|999999|9|9|`)
export const MaxSegmentBody = MaxBytes - 17;

export type Segment = {
    requestId: string;
    nr: number;
    totalCount: number;
    body: string;
};

function bytesToBase64(bytes: Uint8Array) {
    const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join('');
    return btoa(binString);
}
/**
 * Slice data into segments.
 */
export function toSegments(requestId: string, data: Uint8Array): Segment[] {
    const dataString = bytesToBase64(data);
    const totalCount = Math.ceil(dataString.length / MaxBytes);

    const segments = [];
    for (let i = 0; i < totalCount; i++) {
        const body = dataString.slice(i * MaxBytes, (i + 1) * MaxBytes);
        segments.push({
            requestId,
            nr: i,
            totalCount,
            body,
        });
    }
    return segments;
}

/**
 * Create segment from string message.
 */
export function fromMessage(str: string): Res.Result<Segment> {
    const parts = str.split('|');
    if (parts.length === 0) {
        return Res.err('empty string');
    }

    const count = parseInt(parts[0], 10);
    if (count !== 4) {
        return Res.err(`invalid segment parts: ${count}`);
    }

    const requestId = parts[1];
    const nr = parseInt(parts[2], 10);
    const totalCount = parseInt(parts[3], 10);
    const body = parts[4];
    return Res.ok({
        requestId,
        nr,
        totalCount,
        body,
    });
}

/**
 * Return request dependent segment id making it distinguishable to other segments from other requests.
 */
export function id({ nr, requestId }: Segment) {
    return `${requestId}-${nr}`;
}

/**
 * Convert segment to payload.
 */
export function toMessage({ requestId, nr, totalCount, body }: Segment) {
    return [4, requestId, nr, totalCount, body].join('|');
}

/**
 * Pretty print segment in human readable form.
 */
export function prettyPrint({ requestId, nr, totalCount }: Segment) {
    return `segment[rId: ${requestId}, nr: ${nr}, total: ${totalCount}]`;
}
