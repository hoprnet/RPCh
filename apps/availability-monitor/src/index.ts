import { Utils } from '@rpch/sdk';
import { ClientConfig, Pool } from 'pg';
import * as fs from "fs";
import * as availability from './availability';
import Version from './version';

const log = Utils.logger(['availability-monitor']);

function main() {
    // postgres host
    if (!process.env.PGHOST) {
        throw new Error("Missing 'PGHOST' env var.");
    }
    // postgres port
    if (!process.env.PGPORT) {
        throw new Error("Missing 'PGPORT' env var.");
    }
    // postgres database
    if (!process.env.PGDATABASE) {
        throw new Error("Missing 'PGDATABASE' env var.");
    }
    // postgres user
    if (!process.env.PGUSER) {
        throw new Error("Missing 'PGUSER' env var.");
    }
    // postgres password
    if (!process.env.PGPASSWORD) {
        throw new Error("Missing 'PGPASSWORD' env var.");
    }
    // postgres public client cert
    if (process.env.PGSSLMODE !== undefined && !process.env.PGSSLCERT) {
        throw new Error("Missing 'PGSSLCERT' env var.");
    }
    // postgres private client cert
    if (process.env.PGSSLMODE !== undefined && !process.env.PGSSLKEY) {
        throw new Error("Missing 'PGSSLKEY' env var.");
    }
    // postgres public server cert
    if (process.env.PGSSLMODE !== undefined && !process.env.PGSSLROOTCERT) {
        throw new Error("Missing 'PGSSLROOTCERT' env var.");
    }

    // Build the connection configuration
    let dbClientConfig: ClientConfig = { 
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        host: process.env.PGHOST,
        port: Number(process.env.PGPORT),
        database: process.env.PGDATABASE,
    };
    if ((process.env.PGSSLMODE === 'verify-ca' || process.env.PGSSLMODE === 'verify-full' ) && process.env.PGSSLROOTCERT && process.env.PGSSLKEY && process.env.PGSSLCERT) {
        dbClientConfig.ssl = {
            rejectUnauthorized: process.env.PGSSLMODE === 'verify-ca' ? false : true,
            ca: fs.readFileSync(process.env.PGSSLROOTCERT).toString(),
            key: fs.readFileSync(process.env.PGSSLKEY).toString(),
            cert: fs.readFileSync(process.env.PGSSLCERT).toString(),
        };
    }

    const dbPool = new Pool(dbClientConfig);
    log.info('AM[v%s] running', Version);
    availability.start(dbPool);
}

// if this file is the entrypoint of the nodejs process
if (require.main === module) {
    main();
}
