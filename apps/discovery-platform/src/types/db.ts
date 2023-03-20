import pgp from "pg-promise";
import { RegisteredNodeDB } from "./registered-node";

export type DBInstance = pgp.IDatabase<{}>;

export type RegisteredNodeFilters = {
  hasExitNode?: boolean;
  excludeList?: string[];
  status?: RegisteredNodeDB["status"];
};
