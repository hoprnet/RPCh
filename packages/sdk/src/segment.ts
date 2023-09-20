// Maximum bytes we should be sending within the HOPR network.
const MaxBytes = 400;
// Maximum segment overhead is 17 bytes, could be as little as 13 though (e.g. `4|999999|999|999|` vs `4|999999|9|9|`)
export const MaxSegmentBody = MaxBytes - 17;

export type Segment = {
  requestId: number;
  nr: number;
  totalCount: number;
  body: string;
};

/**
 * Slice data into segments.
 */
export function toSegments(requestId: number, hexData: string): Segment[] {
  const chunks: string[] = [];
  for (let i = 0; i < hexData.length; i += MaxSegmentBody) {
    chunks.push(hexData.slice(i, i + MaxSegmentBody));
  }

  return chunks.map((c, nr) => ({
    requestId,
    nr,
    totalCount: chunks.length,
    body: c,
  }));
}

/**
 * Create segment from string message.
 */
export function fromMessage(
  str: string
): { success: true; segment: Segment } | { success: false; error: string } {
  const parts = str.split("|");
  if (parts.length === 0) {
    return { success: false, error: "empty string" };
  }

  const count = parseInt(parts[0], 10);
  if (count !== 4) {
    return { success: false, error: `invalid segment parts: ${count}` };
  }

  const requestId = parseInt(parts[1], 10);
  const nr = parseInt(parts[2], 10);
  const totalCount = parseInt(parts[3], 10);
  const body = parts[4];
  return {
    success: true,
    segment: {
      requestId,
      nr,
      totalCount,
      body,
    },
  };
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
  return [4, requestId, nr, totalCount, body].join("|");
}

/**
 * Pretty print segment in human readable form.
 */
export function prettyPrint({ requestId, nr, totalCount }: Segment) {
  return `segment[rId: ${requestId}, nr: ${nr}, total: ${totalCount}]`;
}
