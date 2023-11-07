import sqlite3 from 'sqlite3';
// import { Utils } from '@rpch/sdk';

// const log = Utils.logger(['exit-node', 'request-store']);

export type RequestStore = {
    db: sqlite3.Database;
};

export function setup(dbFile: string): Promise<RequestStore> {
    return new Promise((res, rej) => {
        const db = new sqlite3.Database(dbFile, (err) => {
            if (err) {
                rej(`Error creating db: ${err}`);
            }
        });

        db.serialize(() => {
            db.run(
                'CREATE TABLE IF NOT EXISTS request_store (uuid TEXT PRIMARY KEY, counter INTEGER)',
                (err) => {
                    if (err) {
                        rej(`Error creating table request_store: ${err}`);
                    }
                }
            );

            db.run(
                'CREATE INDEX IF NOT EXISTS request_store_counter_index ON request_store (counter)',
                (err) => {
                    if (err) {
                        rej(`Error creating index request_store_counter_index: ${err}`);
                    }
                    res({ db });
                }
            );
        });
    });
}

export function addIfAbsent({ db }: RequestStore, id: string) {}

export function close({ db }: RequestStore): Promise<void> {
    return new Promise((res, rej) => {
        db.close((err) => {
            if (err) {
                rej(`Error closing db: ${err}`);
            }
        });
    });
}
