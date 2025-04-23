import { Utils } from '@rpch/sdk';
import { ClientConfig, Pool } from 'pg';
import * as fs from 'fs';
import * as availability from './availability';
import Version from './version';

const log = Utils.logger(['availability-monitor']);

function main() {
    const requiredEnvironmentVariables = ['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD'];
    requiredEnvironmentVariables.forEach((env) => {
        if (!process.env[env]) {
          throw new Error(`Missing '${env}' env var.`);
        }
      });

    const sslMode = process.env.PGSSLMODE ?? 'disable';
    const modesRequiringCerts = new Set(['verify-ca', 'verify-full']);
    if (modesRequiringCerts.has(sslMode)) {
      ['PGSSLCERT', 'PGSSLKEY', 'PGSSLROOTCERT'].forEach((env) => {
        if (!process.env[env]) {
          throw new Error(`Missing '${env}' env var for sslmode='${sslMode}'.`);
        }
      });
    }

    // Build the connection configuration
    const dbClientConfig: ClientConfig = { 
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        host: process.env.PGHOST,
        port: Number(process.env.PGPORT),
        database: process.env.PGDATABASE,
    };
    if ((process.env.PGSSLMODE === 'verify-ca' || process.env.PGSSLMODE === 'verify-full' ) && process.env.PGSSLROOTCERT && process.env.PGSSLKEY && process.env.PGSSLCERT) {
        dbClientConfig.ssl = {
            rejectUnauthorized: process.env.PGSSLMODE === 'verify-full',
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
