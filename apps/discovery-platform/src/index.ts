import migrate from 'node-pg-migrate';
import path from 'path';
import * as fs from "fs";
import { Client, ClientConfig, Pool } from 'pg';
import { Utils } from '@rpch/sdk';

import * as quota from './quota';
import Version from './version';
import type { Secrets } from './secrets';
import { entryServer } from './entry-server';

const IntervalQuotaWrap = 1e3 * 60 * 60; // 1hour

const log = Utils.logger(['discovery-platform']);

const start = async (ops: {
    dbClientConfig: ClientConfig;
    port: number;
    secrets: Secrets;
    url: string;
}) => {
    const migrationsDirectory = path.join(__dirname, '../migrations');
    const dbClient = new Client(ops.dbClientConfig);
    await dbClient.connect().catch((err) => {
        log.error('Error connecting to database: %s', err);
        log.error('Exiting with error');
        process.exit(1);
    });
    log.info('Starting migrations');
    await migrate({
        direction: 'up',
        dbClient,
        migrationsTable: 'migrations',
        dir: migrationsDirectory,
        log: log.verbose,
    }).catch((err) => {
        log.error('Error running migrations: %s', err);
        log.error('Exiting with error');
        process.exit(1);
    }).then(async () => {
        log.info('Migrations finished');
        await dbClient.end();
    });
    log.info('Starting discovery platform server');
    const dbPool = new Pool(ops.dbClientConfig);
    const app = entryServer({
        dbPool: dbPool,
        secrets: ops.secrets,
        url: ops.url,
    });

    // start listening at PORT for requests
    const host = '0.0.0.0';
    /* const server = */ app.listen(ops.port, host, () => {
        log.info(
            'DP[v%s] running on %s:%d with %s',
            Version,
            host,
            ops.port,
            JSON.stringify({ connectionString: '<redacted>', url: ops.url }),
        );
    });
    log.info('Discovery platform server started');

    // schedule initial quota wrapping after startup
    setTimeout(() => runQuotaWrap(dbPool));
};

function runQuotaWrap(dbPool: Pool) {
    quota
        .wrapMonthlyQuotas(dbPool)
        .then((count) => {
            if (count === 0) {
                log.info('no monthly quotas wrapped into history');
            } else {
                log.info('wrapped %d monthly quotas into history', count);
            }
        })
        .catch((err) => log.error('running wrap monthly quota: %s[%o]', JSON.stringify(err), err))
        .finally(() => scheduleQuotaWrap(dbPool));
}

function scheduleQuotaWrap(dbPool: Pool) {
    // schdule next run somehwere between 1h and 1h and 10m
    const next = IntervalQuotaWrap + Math.floor(Math.random() * 10 * 60e3);
    const logH = Math.floor(next / 1000 / 60 / 60);
    const logM = Math.round(next / 1000 / 60) - logH * 60;

    log.verbose('scheduling next quota wrap run in %dh%dm', logH, logM);
    setTimeout(() => runQuotaWrap(dbPool), next);
}

const main = () => {
    // server port
    if (!process.env.PORT) {
        throw new Error("Missing 'PORT' env var.");
    }
    // public url
    if (!process.env.URL) {
        throw new Error("Missing 'URL' env var.");
    }
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
    // admin secret
    if (!process.env.ADMIN_SECRET) {
        throw new Error("Missing 'ADMIN_SECRET' env var.");
    }
    // cookie secret
    if (!process.env.SESSION_SECRET) {
        throw new Error("Missing 'SESSION_SECRET' env var.");
    }
    // google oauth
    if (!process.env.GOOGLE_CLIENT_ID) {
        throw new Error("Missing 'GOOGLE_CLIENT_ID' env var.");
    }
    if (!process.env.GOOGLE_CLIENT_SECRET) {
        throw new Error("Missing 'GOOGLE_CLIENT_SECRET' env var.");
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

    const secrets = {
        adminSecret: process.env.ADMIN_SECRET,
        sessionSecret: process.env.SESSION_SECRET,
        googleClientID: process.env.GOOGLE_CLIENT_ID,
        googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    };

    start({
        dbClientConfig: dbClientConfig,
        port: parseInt(process.env.PORT, 10),
        secrets,
        url: process.env.URL,
    });
};

// if this file is the entrypoint of the nodejs process
if (require.main === module) {
    main();
}
