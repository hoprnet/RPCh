export type Segment = {
  requestId: number;
  nr: number;
  totalCount: number;
  body: string;
};

export function fromString(
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
 * Convert segment to payload.
 */
export function toMessage({ requestId, nr, totalCount, body }: Segment) {
  return [4, requestId, nr, totalCount, body].join("|");
}

/**
 * Pretty print segment in human readable form.
 */
export function prettyPrint({ requestId, nr, totalCount }: Segment) {
  return `segment[rId: ${requestId}, nr: ${nr}, total: ${totalCount}`;
}
