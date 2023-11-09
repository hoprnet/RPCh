import { Utils } from '@rpch/sdk';
import { Pool } from 'pg';
import * as availability from './availability';

const Version = String(process.env.npm_package_version);

const log = Utils.logger(['availability-monitor']);

function main() {
    // server port
    if (!process.env.PORT) {
        throw new Error("Missing 'PORT' env var.");
    }
    // postgres url
    if (!process.env.DATABASE_URL) {
        throw new Error("Missing 'DATABASE_URL' env var.");
    }

    // init db
    const connectionString = process.env.DATABASE_URL;
    const dbPool = new Pool({ connectionString });

    log.info(`AM[v%s] running`, Version);
    availability.start(dbPool);
}

// if this file is the entrypoint of the nodejs process
if (require.main === module) {
    main();
}
