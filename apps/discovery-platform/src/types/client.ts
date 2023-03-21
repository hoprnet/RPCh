import { CamelToSnakeCase, DBTimestamp } from "./general";

export type Client = {
  id: string;
  labels?: string[];
  payment: "premium" | "trial";
};

export type ClientDB = {
  [K in keyof Client as CamelToSnakeCase<string & K>]: Client[K];
} & DBTimestamp;
