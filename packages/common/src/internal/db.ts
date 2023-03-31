import type * as PgMem from "pg-mem";
import type * as Pgp from "pg-promise";
import * as fixtures from "../fixtures";
import type * as Migrate from "node-pg-migrate";

export class MockPgInstanceSingleton {
  private static pgInstance: PgMem.IMemoryDb;
  private static dbInstance: Pgp.IDatabase<{}>;
  private static initialDbState: PgMem.IBackup;

  private constructor(
    private pgMem: typeof PgMem,
    private migrationsDirectory: string
  ) {}

  private async createInstance() {
    let instance = this.pgMem.newDb();
    fixtures.withQueryIntercept(instance);
    await instance.public.migrate({ migrationsPath: this.migrationsDirectory });
    MockPgInstanceSingleton.pgInstance = instance;
    MockPgInstanceSingleton.initialDbState =
      MockPgInstanceSingleton.pgInstance.backup();
    return MockPgInstanceSingleton.pgInstance;
  }

  public static async getInstance(
    pgMem: typeof PgMem,
    migrationsDirectory: string
  ): Promise<PgMem.IMemoryDb> {
    if (!MockPgInstanceSingleton.pgInstance) {
      await new this(pgMem, migrationsDirectory).createInstance();
    }
    return MockPgInstanceSingleton.pgInstance;
  }

  public static async getDbInstance(
    pgMem: typeof PgMem,
    migrationsDirectory: string
  ): Promise<Pgp.IDatabase<{}>> {
    if (!MockPgInstanceSingleton.dbInstance) {
      const instance = await this.getInstance(pgMem, migrationsDirectory);
      MockPgInstanceSingleton.dbInstance = instance.adapters.createPgPromise();
    }
    return MockPgInstanceSingleton.dbInstance;
  }

  public static backup(): void {
    MockPgInstanceSingleton.initialDbState =
      MockPgInstanceSingleton.pgInstance.backup();
  }

  public static getInitialState(): PgMem.IBackup {
    return MockPgInstanceSingleton.initialDbState;
  }
}

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
