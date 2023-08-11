import assert from "assert";
import { getTestingConnectionString, TestingDatabaseInstance } from "./db";

describe("test TestingDatabaseInstance class", function () {
  it("should create, connect, and close DB", async function () {
    const instance = await TestingDatabaseInstance.create(
      getTestingConnectionString()
    );

    const response = await instance.db.many(
      "SELECT * FROM information_schema.tables"
    );
    assert(response.length > 0);

    await instance.close();
  });

  it("should reset DB", async function () {
    const instance = await TestingDatabaseInstance.create(
      getTestingConnectionString()
    );

    // create a table
    await instance.db.query("CREATE TABLE temporary_table (ID int)");
    // recreate instance
    await instance.reset();

    try {
      await instance.db.any("SELECT * FROM temporary_table");
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
