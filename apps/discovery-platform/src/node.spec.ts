import migrate from 'node-pg-migrate';
import path from 'path';
import { Pool } from 'pg';

import * as node from './node';

// import * as node from './node';

describe('node', function () {
    let dbPool: Pool;
    beforeAll(async () => {
        const connectionString = process.env.DATABASE_URL as string;
        const migrationsDirectory = path.join(__dirname, '../migrations');
        dbPool = new Pool({ connectionString });

        await migrate({
            direction: 'up',
            databaseUrl: connectionString,
            migrationsTable: 'migrations',
            dir: migrationsDirectory,
        });

        const nodes = [
            'insert into registered_nodes',
            '(id, is_exit_node, chain_id, hoprd_api_endpoint, hoprd_api_token, exit_node_pub_key, native_address)',
            "values (gen_random_uuid(), false, 100, 'http://endpoint1', 'token1', 'pubkey1', 'address1'),",
            "(gen_random_uuid(), false, 100, 'http://endpoint2', 'token2', 'pubkey2', 'address2'),",
            "(gen_random_uuid(), true, 100, 'http://endpoint3', 'token3', 'pubkey3', 'address3'),",
            "(gen_random_uuid(), true, 100, 'http://endpoint4', 'token4', 'pubkey4', 'address4')",
        ].join(' ');
        const users = "insert into users (id, name) values (gen_random_uuid(), 'user1')";
        const clients = [
            'insert into clients (id, user_id, external_token)',
            "values (gen_random_uuid(), (select id from users), 'client_token1')",
        ].join(' ');
        const assocs = [
            'insert into associated_nodes (user_id, node_id)',
            "values ((select id from users), (select id from registered_nodes where native_address = 'address2')),",
            "((select id from users), (select id from registered_nodes where native_address = 'address4'))",
        ].join(' ');
        const zhPairings = [
            'insert into zero_hop_pairings (entry_id, exit_id)',
            "values ((select id from registered_nodes where native_address = 'address1'), (select id from registered_nodes where native_address = 'address3')),",
            "((select id from registered_nodes where native_address = 'address1'), (select id from registered_nodes where native_address = 'address4')),",
            "((select id from registered_nodes where native_address = 'address2'), (select id from registered_nodes where native_address = 'address3')),",
            "((select id from registered_nodes where native_address = 'address2'), (select id from registered_nodes where native_address = 'address4'))",
        ].join(' ');

        await dbPool.query(nodes);
        await dbPool.query(users);
        await dbPool.query(clients);
        await dbPool.query(assocs);
        await dbPool.query(zhPairings);
    });

    afterAll(async () => {
        await dbPool.query('delete from zero_hop_pairings');
        await dbPool.query('delete from associated_nodes');
        await dbPool.query('delete from clients');
        await dbPool.query('delete from monthly_quota_usages');
        await dbPool.query('delete from users');
        await dbPool.query('delete from registered_nodes');

        return dbPool.end();
    });

    it('listPairings', async function () {
        const resAll = await node.listPairings(dbPool, 10, { forceZeroHop: true });
        expect(resAll.length).toBe(4);

        const resClients = await dbPool.query('select id from clients');
        const clientId = resClients.rows[0];
        const resAssocs = await node.listPairings(dbPool, 10, { forceZeroHop: true, clientId });
        expect(resAssocs.length).toBe(2);
    });
});
