import pgp from "pg-promise";
import { createLogger } from "./utils";

const log = createLogger(["db"]);

export type DBInstance = pgp.IDatabase<{}>;

export type * from "@rpch/discovery-platform/src/types";
export { getRegisteredNodes } from "@rpch/discovery-platform/src/db";

// tables we are interesting in using
const TABLES = {
  NODE_INFO: "node_info",
};
