import fs from "fs";
import { IMemoryDb, newDb } from "pg-mem";

export async function mockPgInstance(): Promise<IMemoryDb> {
  const pgInstance = await newDb();
  pgInstance.public.none(fs.readFileSync("dump.sql", "utf8"));
  return pgInstance;
}
