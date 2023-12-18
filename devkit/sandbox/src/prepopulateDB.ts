import dotenv from 'dotenv';
import path from 'path';
import { Pool } from 'pg';
import { api as hoprAPI } from '@hoprnet/hopr-sdk';
import nodes from './nodes'

dotenv.config({ path: path.resolve(__dirname, '../src/.env') });
const connectionString = process.env.DATABASE_URL_EXTERNAL;
const dbPool = new Pool({ connectionString });

main();
async function main() {
    await waitForMigrationToFinish();
    await insertNodes();
    await insertUser();
    await insertClient();
    return;
}

async function waitForMigrationToFinish(){
    let success = false;
    let error;
    for(let i = 0; i < 5 * 60; i++) { // try for 10 min
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
            const query1 = `SELECT * from registered_nodes`
            await dbPool.query(query1);
            const query2 = `SELECT * from users`
            await dbPool.query(query2);
            success = true;
            break;
        } catch (e){
            error = e;
        }
    }
    if(!success) {
        console.error(error);
        throw('Could not find tables in the DB. Exiting.');
    }
    return;
}

async function insertNode(input: {
    id: string,
    is_exit_node: boolean,
    chain_id: number,
    hoprd_api_endpoint: string,
    hoprd_api_token: string,
    exit_node_pub_key: string,
    native_address: string
}){
    const query = [
        'INSERT INTO registered_nodes',
        '(id, is_exit_node, chain_id, hoprd_api_endpoint, hoprd_api_token, exit_node_pub_key, native_address)',
        'VALUES ($1, $2, $3, $4, $5, $6, $7)',
    ].join(' ');
    const values = [input.id, input.is_exit_node, input.chain_id, input.hoprd_api_endpoint, input.hoprd_api_token, input.exit_node_pub_key, input.native_address];
    const resp = await dbPool.query(query, values);
    return resp;
}

async function insertNodes(){
    try {
        for(let i = 0; i < nodes.length; i++) {
            const addresses = await hoprAPI.getAddresses({apiEndpoint: nodes[i], apiToken: process.env.HOPRD_API_TOKEN as string});
            await insertNode({
                id: addresses.hopr,
                is_exit_node: i%2 === 0, // 2 entry nodes, 3 exit nodes
                chain_id: 100,
                hoprd_api_endpoint: nodes[i],//.replace('localhost', 'pluto'),
                hoprd_api_token: process.env.HOPRD_API_TOKEN as string,
                exit_node_pub_key: process.env[`EXIT_NODE_PUB_KEY_${i+1}`] as string,
                native_address: addresses.native
            })
            console.log(`Nodes ${addresses.hopr} added to the database.`);
        }
        console.log('All nodes added to the database.');
    } catch (e){
        console.error('ERROR: Unable to add nodes to registered_nodes table in DB', e);
    }
}

async function insertUser(){
    try {
        const query = `INSERT INTO users (id) values (gen_random_uuid());`
        await dbPool.query(query);
        console.log('User inserted to the database.')
    } catch (e){
        console.error('ERROR: Unable to insert user to the database.', e);
    }
}

async function insertClient(){
    try {
        const query = `INSERT INTO clients (id, user_id, external_token) values (gen_random_uuid(), (select id from users), '${process.env.SECRET_TOKEN_TESTING}');`
        await dbPool.query(query);
        console.log('Client inserted to the database.')
    } catch (e){
        console.error('ERROR: Unable to insert client to the database.', e);
    }
}


