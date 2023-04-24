export type CompressedDiagram = `${"0" | "1"}${"0" | "1"}${"0" | "1"}${
  | "0"
  | "1"}${"0" | "1"}${"0" | "1"}`;

export type CompressedPayload = `${CompressedDiagram}${string}`;

export type Dictionary = { [x: string]: string };
