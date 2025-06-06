import migrate from 'node-pg-migrate';
import path from 'path';
import * as fs from 'fs';
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
    })
        .catch((err) => {
            log.error('Error running migrations: %s', err);
            log.error('Exiting with error');
            process.exit(1);
        })
        .then(async () => {
            log.info('Migrations finished');
        });
    await dbClient.end();
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
    const requiredEnvironmentVariables = [
        'PORT',
        'URL',
        'PGHOST',
        'PGPORT',
        'PGDATABASE',
        'PGUSER',
        'PGPASSWORD',
        'ADMIN_SECRET'
    ];
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
    if (
        (process.env.PGSSLMODE === 'verify-ca' || process.env.PGSSLMODE === 'verify-full') &&
        process.env.PGSSLROOTCERT &&
        process.env.PGSSLKEY &&
        process.env.PGSSLCERT
    ) {
        dbClientConfig.ssl = {
            rejectUnauthorized: process.env.PGSSLMODE === 'verify-full',
            ca: fs.readFileSync(process.env.PGSSLROOTCERT).toString(),
            key: fs.readFileSync(process.env.PGSSLKEY).toString(),
            cert: fs.readFileSync(process.env.PGSSLCERT).toString(),
        };
    }

    const secrets = {
        adminSecret: process.env.ADMIN_SECRET || ''
    };

    start({
        dbClientConfig: dbClientConfig,
        port: parseInt(process.env.PORT || '3020', 10),
        secrets,
        url: process.env.URL || 'http://localhost:3020',
    });
};

// if this file is the entrypoint of the nodejs process
if (require.main === module) {
    main();
}
