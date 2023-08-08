import assert from "assert";
import * as path from "path";
import { TestingDatabaseInstance } from "./db";

const connectionString =
  "postgresql://postgres:mysecretpassword@127.0.0.1:5432";
const migrationsDir = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "apps",
  "discovery-platform",
  "migrations"
);

describe("test TestingDatabaseInstance class", function () {
  it("should create, connect, and close DB", async function () {
    const instance = await TestingDatabaseInstance.create(
      connectionString,
      migrationsDir
    );

    const response = await instance
      .getDatabase()
      .many("SELECT * FROM information_schema.tables");
    assert(response.length > 0);

    await instance.close();
  }, 10e3);

  it("should restore DB", async function () {
    let instance = await TestingDatabaseInstance.create(
      connectionString,
      migrationsDir
    );
    let db = instance.getDatabase();

    // create a table
    await db.query("CREATE TABLE temporary_table (ID int)");
    // recreate instance
    instance = await instance.recreate();
    db = instance.getDatabase();

    try {
      await db.any("SELECT * FROM temporary_table");
    } catch (err: unknown) {
      assert(
        (err as Error).message.includes(
          `relation "temporary_table" does not exist`
        )
      );
    }

    await instance.close();
  });
});
