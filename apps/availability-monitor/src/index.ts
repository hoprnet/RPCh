import { Pool } from 'pg';
import * as availability from './availability';

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

    availability.start(dbPool);
}

// if this file is the entrypoint of the nodejs process
if (require.main === module) {
    main();
}
