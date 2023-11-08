import sqlite3 from 'sqlite3';
//import { Result as Res } from '@rpch/sdk';

// const log = Utils.logger(['exit-node', 'request-store']);

export type RequestStore = {
    db: sqlite3.Database;
};

export enum AddRes {
    Success,
    Duplicate,
}

export function setup(dbFile: string): Promise<RequestStore> {
    return new Promise((res, rej) => {
        const db = new sqlite3.Database(dbFile, (err) => {
            if (err) {
                return rej(`Error creating db: ${err}`);
            }
        });

        db.serialize(() => {
            db.run(
                'CREATE TABLE IF NOT EXISTS request_store (uuid TEXT PRIMARY KEY, counter INTEGER)',
                (err) => {
                    if (err) {
                        return rej(`Error creating table request_store: ${err}`);
                    }
                },
            );

            db.run(
                'CREATE INDEX IF NOT EXISTS request_store_counter_index ON request_store (counter)',
                (err) => {
                    if (err) {
                        return rej(`Error creating index request_store_counter_index: ${err}`);
                    }
                    return res({ db });
                },
            );
        });
    });
}

export function addIfAbsent({ db }: RequestStore, id: string, counter: number): Promise<AddRes> {
    return new Promise((res, rej) => {
        db.run(
            'INSERT INTO request_store (uuid, counter) VALUES ($id, $counter);',
            {
                $id: id,
                $counter: counter,
            },
            (err) => {
                if (err) {
                    const errStr = String(err).toLowerCase();
                    const cts = ['sqlite_constraint', 'unique', 'request_store.uuid'];
                    if (cts.every((c) => errStr.includes(c))) {
                        return res(AddRes.Duplicate);
                    }
                    return rej(`Error inserting into request_store: ${err}`);
                }
                return res(AddRes.Success);
            },
        );
    });
}

export function close({ db }: RequestStore): Promise<void> {
    return new Promise((res, rej) => {
        db.close((err) => {
            if (err) {
                return rej(`Error closing db: ${err}`);
            }
            return res();
        });
    });
}
