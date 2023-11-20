import migrate from 'node-pg-migrate';
import { Pool } from 'pg';
import { Utils } from '@rpch/sdk';

import * as quota from './quota';
import Version from './version';
import path from 'path';
import type { Secrets } from './secrets';
import { entryServer } from './entry-server';

const IntervalQuotaWrap = 1e3 * 60 * 60; // 1hour

const log = Utils.logger(['discovery-platform']);

const start = async (ops: {
    connectionString: string;
    dbPool: Pool;
    port: number;
    secrets: Secrets;
    url: string;
}) => {
    const migrationsDirectory = path.join(__dirname, '../migrations');

    await migrate({
        direction: 'up',
        databaseUrl: ops.connectionString,
        migrationsTable: 'migrations',
        dir: migrationsDirectory,
        log: log.verbose,
    });

    const app = entryServer({
        dbPool: ops.dbPool,
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

    // schedule initial quota wrapping after startup
    setTimeout(() => runQuotaWrap(ops.dbPool));
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
    // postgres url
    if (!process.env.DATABASE_URL) {
        throw new Error("Missing 'DATABASE_URL' env var.");
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

    // init db
    const connectionString = process.env.DATABASE_URL;
    const dbPool = new Pool({ connectionString });

    const secrets = {
        adminSecret: process.env.ADMIN_SECRET,
        sessionSecret: process.env.SESSION_SECRET,
        googleClientID: process.env.GOOGLE_CLIENT_ID,
        googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    };

    start({
        connectionString,
        dbPool,
        port: parseInt(process.env.PORT, 10),
        secrets,
        url: process.env.URL,
    });
};

// if this file is the entrypoint of the nodejs process
if (require.main === module) {
    main();
}
