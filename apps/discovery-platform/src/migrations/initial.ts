import { DBInstance } from "../db";
import fs from "fs";

export const runInitialSqlDump = async (db: DBInstance) => {
  // create tables if they do not exist in the db
  const schemaSql = fs.readFileSync("dump.sql", "utf8").toString();
  const existingTables = await db.manyOrNone(
    "SELECT * FROM information_schema.tables WHERE table_name IN ('funding_requests', 'quotas', 'registered_nodes', 'clients')"
  );
  if (!existingTables.length) {
    await db.none(schemaSql);
  }
};
