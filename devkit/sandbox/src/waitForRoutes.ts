import dotenv from 'dotenv';
import path from 'path';
import { Pool } from 'pg';

dotenv.config({ path: path.resolve(__dirname, '../src/.env') });

const connectionString = process.env.DATABASE_URL;
const dbPool = new Pool({ connectionString });

main();
async function main() {
    await waitForRoutes();
    return;
}

async function waitForRoutes(){
    let success = false;
    let error;
    for(let i = 0; i < 5 * 60; i++) { // try for 10 min
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
            const query1 = `SELECT * from one_hop_pairings`
            const one_hop_pairings = await dbPool.query(query1);
            const query2 = `SELECT * from zero_hop_pairings`
            const zero_hop_pairings = await dbPool.query(query2);
            if(one_hop_pairings.rows.length > 0 && zero_hop_pairings.rows.length > 0) {
                console.log('Success: Routes present in the DB.');
                success = true;
                break;
            }
        } catch (e){
            error = e;
        }
    }
    if(!success) {
        console.error(error);
        throw('Could not find routes in the DB. Exiting.');
    }
    return;
}
