import pgp from "pg-promise";
import { RequestDB } from "./request";

export type DBInstance = pgp.IDatabase<{}>;

export type RequestFilters = {
  [K in keyof RequestDB as string & K]?: RequestDB[K];
};
