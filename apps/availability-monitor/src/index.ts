import { Utils } from '@rpch/sdk';
import { Pool } from 'pg';

import * as availability from './availability';
import Version from './version';

const log = Utils.logger(['availability-monitor']);

function main() {
    // postgres url
    if (!process.env.DATABASE_URL) {
        throw new Error("Missing 'DATABASE_URL' env var.");
    }

    // init db
    const connectionString = process.env.DATABASE_URL;
    const dbPool = new Pool({ connectionString });

    const logO = { connectionString: '<redacted>' };
    log.info('AM[v%s] running with %o', Version, logO);
    availability.start(dbPool);
}

// if this file is the entrypoint of the nodejs process
if (require.main === module) {
    main();
}
