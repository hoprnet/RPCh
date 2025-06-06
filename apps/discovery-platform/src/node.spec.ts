import migrate from 'node-pg-migrate';
import path from 'path';
import { Client, ClientConfig, Pool } from 'pg';

import * as node from './node';

// import * as node from './node';

describe('node', function () {
    let dbPool: Pool;
    beforeAll(async () => {
        // Build the connection configuration
        const dbClientConfig: ClientConfig = {
            user: process.env.PGUSER,
            password: process.env.PGPASSWORD,
            host: process.env.PGHOST,
            port: Number(process.env.PGPORT),
            database: process.env.PGDATABASE,
        };
        const dbClient = new Client(dbClientConfig);
        await dbClient.connect();

        const migrationsDirectory = path.join(__dirname, '../migrations');
        dbPool = new Pool(dbClientConfig);

        await migrate({
            direction: 'up',
            dbClient,
            migrationsTable: 'migrations',
            dir: migrationsDirectory,
        });
       await dbClient.end();

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

        // reset db
        await dbPool.query('delete from zero_hop_pairings');
        await dbPool.query('delete from associated_nodes');
        await dbPool.query('delete from clients');
        await dbPool.query('delete from monthly_quota_usages');
        await dbPool.query('delete from users');
        await dbPool.query('delete from registered_nodes');

        // populate db
        await dbPool.query(nodes);
        await dbPool.query(users);
        await dbPool.query(clients);
        await dbPool.query(assocs);
        await dbPool.query(zhPairings);
    });

    afterAll(async () => {
        // reset db
        await dbPool.query('delete from zero_hop_pairings');
        await dbPool.query('delete from associated_nodes');
        await dbPool.query('delete from clients');
        await dbPool.query('delete from monthly_quota_usages');
        await dbPool.query('delete from users');
        await dbPool.query('delete from registered_nodes');

        return dbPool.end();
    });

    describe('listPairings', function () {
        it('delivers routes without client associated exit nodes', async function () {
            const { rows } = await dbPool.query(
                'select id from registered_nodes order by native_address',
            );
            const [{ id: id1 }, { id: id2 }, { id: id3 }] = rows;

            const resAll = await node.listPairings(dbPool, 10, { forceZeroHop: true });
            expect(resAll.length).toBe(2);
            expect(resAll).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ entryId: id1, exitId: id3 }),
                    expect.objectContaining({ entryId: id2, exitId: id3 }),
                ]),
            );
        });

        it('delivers client associated routes with client associated exit nodes', async function () {
            const { rows: rowsNodes } = await dbPool.query(
                'select id from registered_nodes order by native_address',
            );
            const [{ id: id1 }, { id: id2 }, , { id: id4 }] = rowsNodes;

            const { rows: rowsClients } = await dbPool.query('select id from clients limit 1');
            const [{ id: clientId }] = rowsClients;

            const resAssocs = await node.listPairings(dbPool, 10, { forceZeroHop: true, clientId });
            expect(resAssocs).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ entryId: id1, exitId: id4 }),
                    expect.objectContaining({ entryId: id2, exitId: id4 }),
                ]),
            );
        });
    });
});
