import { ConnectionConfig, EscapeFunctions, Connection } from "mysql";
import mysql, { ServerlessMysql } from "serverless-mysql";
import mysql2 from "mysql2";
interface DBInterface extends ServerlessMysql {}

export default class DBAdapter implements DBInterface {
  private db: ServerlessMysql;
  private static _instance: DBAdapter;

  private constructor() {
    this.db = mysql({
      config: {
        host: process.env.DB_HOST,
        database: process.env.DB_DATABASE,
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        port: Number(process.env.DB_PORT),
      },
      library: mysql2 as unknown as Function,
    });
  }

  public static getInstance() {
    return this._instance || (this._instance = new this());
  }

  public connect(wait?: number | undefined): Promise<void> {
    return this.db.connect(wait);
  }
  public config(config?: ConnectionConfig | undefined): ConnectionConfig {
    return this.db.config(config);
  }
  public query<T>(...args: any[]): Promise<T> {
    return this.db.query(...args);
  }
  public end(): Promise<void> {
    return this.db.end();
  }
  public escape(str: string): EscapeFunctions {
    return this.db.escape(str);
  }
  public quit(): void {
    return this.db.quit();
  }
  public transaction(): mysql.Transaction {
    return this.db.transaction();
  }
  public getCounter(): number {
    return this.db.getCounter();
  }
  public getClient(): Connection {
    return this.db.getClient();
  }
  public getConfig(): ConnectionConfig {
    return this.db.getConfig();
  }
  public getErrorCount(): number {
    return this.db.getErrorCount();
  }
}
