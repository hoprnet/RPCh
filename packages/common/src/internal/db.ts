import type * as Migrate from "node-pg-migrate";
import type { IClient } from "pg-promise/typescript/pg-subset";
import migrate from "node-pg-migrate";
import pgp from "pg-promise";
import createLogger from "../utils/logger";

const logger = createLogger("common:internal")(["db"]);

type IPg = pgp.IMain<{}, IClient>;
type IDb = pgp.IDatabase<{}, IClient>;

/**
 * Used by unit tests.
 * Requires a running postgres database.
 * It will create temporary databases in which
 * tests are run. Additionally exposes some handy
 * utilities.
 */
export class TestingDatabaseInstance {
  private constructor(
    private pg: IPg,
    private db: IDb,
    private connectionString: string,
    private databaseName: string,
    private migrationsDirectory?: string
  ) {}

  private static genRandomDatabaseName(): string {
    const alphabet = "abcdefghijklmnopqrstuvwxyz";
    return Array.from(Array(20))
      .map(() => alphabet[Math.floor(Math.random() * alphabet.length)])
      .join("");
  }

  private static async createDatabase(
    connectionString: string,
    databaseName: string
  ): Promise<void> {
    logger.verbose("Creating new database %s", databaseName);
    const primaryDb = pgp()({
      connectionString: connectionString,
    });
    await new Promise<void>(async (resolve, reject) => {
      try {
        await primaryDb.any(`CREATE DATABASE ${databaseName};`);
        return resolve();
      } catch (err) {
        if (err && String(err).includes("already exists")) {
          return resolve();
        } else {
          return reject(err);
        }
      }
    });
    await primaryDb.$pool.end();
  }

  private static async dropDatabase(
    connectionString: string,
    databaseName: string
  ): Promise<void> {
    logger.verbose("Dropping new database %s", databaseName);
    const primaryDb = pgp()({
      connectionString: connectionString,
    });
    await primaryDb.any(`DROP DATABASE IF EXISTS ${databaseName}`);
    await primaryDb.$pool.end();
  }

  public static async create(
    connectionString: string,
    migrationsDirectory?: string,
    customDatabaseName?: string
  ): Promise<TestingDatabaseInstance> {
    const databaseName =
      customDatabaseName || TestingDatabaseInstance.genRandomDatabaseName();
    const pg = pgp();

    // connect to primary DB and create new DB
    await TestingDatabaseInstance.createDatabase(
      connectionString,
      databaseName
    );

    // connect to newly created DB
    const db = pg({
      connectionString: connectionString + "/" + databaseName,
      database: databaseName,
    });

    // run migrations
    if (migrationsDirectory) {
      logger.verbose("Running migrations on %s", databaseName);
      await runMigrations(
        connectionString + "/" + databaseName,
        migrationsDirectory,
        migrate
      );
    }

    const instance = new this(
      pg,
      db,
      connectionString,
      databaseName,
      migrationsDirectory
    );

    return instance;
  }

  public getDatabase(): IDb {
    return this.db;
  }

  public async recreate(): Promise<TestingDatabaseInstance> {
    logger.verbose("Resetting %s", this.databaseName);
    await this.close();
    return TestingDatabaseInstance.create(
      this.connectionString,
      this.migrationsDirectory,
      this.databaseName
    );
  }

  public async close(): Promise<void> {
    await this.db.$pool.end();
    await TestingDatabaseInstance.dropDatabase(
      this.connectionString,
      this.databaseName
    );
  }
}

/**
 * Run migrations against a given connection string.
 * @param dbUrl
 * @param migrationsDirectory
 * @param migrate
 */
export const runMigrations = async (
  dbUrl: string,
  migrationsDirectory: string,
  migrate: typeof Migrate.default
) => {
  await migrate({
    schema: "public",
    direction: "up",
    count: Infinity,
    databaseUrl: dbUrl,
    migrationsTable: "migrations",
    dir: migrationsDirectory,
  });
};
