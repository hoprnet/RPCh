import pgp from "pg-promise";

export type DBInstance = pgp.IDatabase<{}>;

export type {
  RegisteredNode,
  RegisteredNodeDB,
} from "@rpch/discovery-platform/build/types";
export {
  getRegisteredNodes,
  getRegisteredNode,
} from "@rpch/discovery-platform/build/db";
