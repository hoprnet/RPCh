import pgp from "pg-promise";
import { createLogger } from "./utils";

const log = createLogger(["db"]);

export type DBInstance = pgp.IDatabase<{}>;

export type {
  RegisteredNode,
  RegisteredNodeDB,
} from "@rpch/discovery-platform/build/types";
export {
  getRegisteredNodes,
  getRegisteredNode,
} from "@rpch/discovery-platform/build/db";

// tables we are interesting in using
const TABLES = {
  NODE_INFO: "node_info",
};
