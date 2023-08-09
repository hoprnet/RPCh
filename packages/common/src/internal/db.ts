import type * as Migrate from "node-pg-migrate";
import type { IClient } from "pg-promise/typescript/pg-subset";
import migrate from "node-pg-migrate";
import pgp from "pg-promise";
import createLogger from "../utils/logger";

const logger = createLogger("common:internal")(["db"]);

type IPg = pgp.IMain<{}, IClient>;
type IDb = pgp.IDatabase<{}, IClient>;

/** checks ENV for variable 'TESTING_DB_CONNECTION_STRING' or give it the default value */
export function getTestingConnectionString(): string {
  return (
    process.env["TESTING_DB_CONNECTION_STRING"] ||
    "postgresql://postgres:postgres@127.0.0.1:5432"
  );
}

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
    private _db: IDb,
    private connectionString: string,
    private databaseName: string,
    private migrationsDirectory?: string
  ) {}

  /** returns the current DB instance */
  public get db(): IDb {
    // ensures that when this property is called
    // the newest instance of the DB connection
    // is returned
    const instance = this;
    return new Proxy(this._db, {
      get(_target: IDb, key: keyof IDb) {
        return instance._db[key];
      },
    });
  }

  /** generates a random 20 character alphabetical string */
  private static genRandomDatabaseName(): string {
    const alphabet = "abcdefghijklmnopqrstuvwxyz";
    return Array.from(Array(20))
      .map(() => alphabet[Math.floor(Math.random() * alphabet.length)])
      .join("");
  }

  /** create a new database */
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

  /** delete database */
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

  /**
   * Create a new temporary database.
   * @param connectionString connection string of the primary database which will be used to create new databases
   * @param migrationsDirectory optional directory that contains migrations
   * @param customPg optional uses specific PG instance
   * @param customDatabaseName optional uses specific database name
   */
  public static async create(
    connectionString: string,
    migrationsDirectory?: string,
    customPg?: IPg,
    customDatabaseName?: string
  ): Promise<TestingDatabaseInstance> {
    const pg = customPg || pgp();
    const databaseName =
      customDatabaseName || TestingDatabaseInstance.genRandomDatabaseName();

    // connect to primary DB and create new DB
    await TestingDatabaseInstance.createDatabase(
      connectionString,
      databaseName
    );

    // connection string for our temporary database
    const tempConnectionString = ((): string => {
      const url = new URL(connectionString);
      return `postgres://${url.username}:${url.password}@${url.hostname}:${url.port}/${databaseName}`;
    })();

    // connect to newly created DB
    const db = pg({
      connectionString: tempConnectionString,
      database: databaseName,
    });

    // run migrations
    if (migrationsDirectory) {
      logger.verbose("Running migrations on %s", databaseName);
      await runMigrations(tempConnectionString, migrationsDirectory, migrate);
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

  /** drop temporary database and create a new one with the same name */
  public async reset(): Promise<void> {
    logger.verbose("Resetting %s", this.databaseName);
    await this.close();
    const newInstance = await TestingDatabaseInstance.create(
      this.connectionString,
      this.migrationsDirectory,
      this.pg,
      this.databaseName
    );
    this._db = newInstance.db;
  }

  /** drop temporary database and close our connection to it */
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
    log: logger.verbose,
  });
};
