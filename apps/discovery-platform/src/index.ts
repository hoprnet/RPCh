import migrate from 'node-pg-migrate';
import { Pool } from 'pg';
import { Utils } from '@rpch/sdk';

import Version from './version';
import path from 'path';
import type { Secrets } from './secrets';
import { entryServer } from './entry-server';

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

    // set server timeout to 30s
    // server.setTimeout(30e3);

    // Create a task queue with a concurrency limit of QUEUE_CONCURRENCY_LIMIT
    // to process nodes in parallel for commitment check
    //   const queueCheckCommitment = async.queue(
    //     async (task: RegisteredNodeDB, callback) => {
    //       try {
    //         const channels = await getChannelsFromGraph(task.id);
    //         const nodeIsCommitted = await checkCommitment({
    //           channels,
    //           node: task,
    //           minBalance: constants.BALANCE_THRESHOLD,
    //           minChannels: constants.CHANNELS_THRESHOLD,
    //         });
    //
    //         if (nodeIsCommitted) {
    //           await updateRegisteredNode(ops.db, {
    //             ...task,
    //             status: "READY",
    //           });
    //         }
    //
    //         callback();
    //       } catch (e) {}
    //     },
    //     constants.QUEUE_CONCURRENCY_LIMIT
    //   );
    //
    // adds fresh node to queue
    // const checkCommitmentInterval = setInterval(
    //   () =>
    //     checkCommitmentForFreshNodes(
    //       ops.db,
    //       queueCheckCommitment,
    //       (node, err) => {
    //         if (err) {
    //           log.error("Failed to process node", node, err);
    //         }
    //       }
    //     ),
    //   60e3
    // );

    // fetch and cache availability monitor results
    // const updateAvailabilityMonitorResultsInterval = setInterval(async () => {
    //   try {
    //     if (!ops.availabilityMonitorUrl) return;
    //     const response = await fetch(
    //       `${ops.availabilityMonitorUrl}/api/nodes`
    //     ).then(
    //       (res) => res.json() as unknown as [string, AvailabilityMonitorResult][]
    //     );
    //     availabilityMonitorResults = new Map(response);
    //     log.verbose(
    //       "Updated availability monitor results with size %i",
    //       availabilityMonitorResults.size
    //     );
    //   } catch (error) {
    //     log.error("Error fetching availability monitor results", error);
    //   }
    // }, 1000);

    return () => {
        // clearInterval(checkCommitmentInterval);
        // clearInterval(updateAvailabilityMonitorResultsInterval);
    };
};

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
