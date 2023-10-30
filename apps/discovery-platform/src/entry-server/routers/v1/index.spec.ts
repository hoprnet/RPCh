import assert from 'assert';
import express, { type Express } from 'express';
import request from 'supertest';
import { v1Router } from '.';
import { getClient } from '../../../client';
import { getSumOfQuotasPaidByClient } from '../../../quota';
import * as registeredNode from '../../../registered-node';
import { RegisteredNode, RegisteredNodeDB } from '../../../types';
import memoryCache from 'memory-cache';
import * as Prometheus from 'prom-client';
import path from 'path';
import { MetricManager } from '@rpch/common/build/internal/metric-manager';
import {
    TestingDatabaseInstance,
    getTestingConnectionString,
} from '@rpch/common/build/internal/db';

const BASE_QUOTA = BigInt(1);
const SECRET = 'SECRET';

const mockNode = (peerId?: string, hasExitNode?: boolean): RegisteredNode => ({
    hasExitNode: hasExitNode ?? true,
    peerId: peerId ?? 'peerId',
    chainId: 100,
    hoprdApiEndpoint: 'localhost:5000',
    hoprdApiToken: 'someToken',
    exitNodePubKey: 'somePubKey',
    nativeAddress: 'someAddress',
});

const UNSTABLE_NODE_PEERID = 'unstablePeerId';
const getAvailabilityMonitorResultsMock = () => new Map<string, any>([[UNSTABLE_NODE_PEERID, {}]]);

describe('test v1 router', function () {
    let dbInstance: TestingDatabaseInstance;
    let app: Express;

    beforeAll(async function () {
        const migrationsDirectory = path.join(__dirname, '../../../../migrations');
        dbInstance = await TestingDatabaseInstance.create(
            getTestingConnectionString(),
            migrationsDirectory
        );
    });

    beforeEach(async function () {
        await dbInstance.reset();
        const register = new Prometheus.Registry();
        const metricManager = new MetricManager(Prometheus, register, 'test');
        app = express().use(
            '',
            v1Router({
                db: dbInstance.db,
                baseQuota: BASE_QUOTA,
                metricManager: metricManager,
                secret: SECRET,
                getAvailabilityMonitorResults: getAvailabilityMonitorResultsMock,
            })
        );
    });

    afterEach(() => {
        jest.resetAllMocks();
        memoryCache.clear();
    });

    afterAll(async function () {
        await dbInstance.close();
    });

    it('should register a node', async function () {
        const node = mockNode();
        const responseRequestTrialClient = await request(app).get('/request/trial');
        const trialClientId: string = responseRequestTrialClient.body.client;
        await request(app).post('/node/register').set('X-Rpch-Client', trialClientId).send(node);
        const createdNode = await request(app)
            .get(`/node/${node.peerId}`)
            .set('X-Rpch-Client', trialClientId);
        assert.equal(createdNode.body.node.id, node.peerId);
    });

    it('should get a node', async function () {
        const node = mockNode();
        const responseRequestTrialClient = await request(app).get('/request/trial');
        const trialClientId: string = responseRequestTrialClient.body.client;
        await request(app).post('/node/register').set('X-Rpch-Client', trialClientId).send(node);
        await request(app)
            .post('/node/register')
            .set('X-Rpch-Client', trialClientId)
            .send(mockNode('fake'));
        const createdNode = await request(app)
            .get(`/node/${node.peerId}`)
            .set('X-Rpch-Client', trialClientId);
        assert.equal(createdNode.body.node.id, node.peerId);
    });

    it('should get all nodes that are exit node', async function () {
        const responseRequestTrialClient = await request(app).get('/request/trial');
        const trialClientId: string = responseRequestTrialClient.body.client;

        await Promise.all([
            request(app)
                .post('/node/register')
                .set('X-Rpch-Client', trialClientId)
                .send(mockNode('notExit1', false)),
            request(app)
                .post('/node/register')
                .set('X-Rpch-Client', trialClientId)
                .send(mockNode('notExit2', false)),
            request(app)
                .post('/node/register')
                .set('X-Rpch-Client', trialClientId)
                .send(mockNode('exit3', true)),
            request(app)
                .post('/node/register')
                .set('X-Rpch-Client', trialClientId)
                .send(mockNode('exit4', true)),
            request(app)
                .post('/node/register')
                .set('X-Rpch-Client', trialClientId)
                .send(mockNode(UNSTABLE_NODE_PEERID, true)),
        ]);

        const allExitNodes = await request(app)
            .get(`/node?hasExitNode=true`)
            .set('X-Rpch-Client', trialClientId);

        assert.equal(allExitNodes.body.length, 2);
    });

    it('should get all nodes that are not exit nodes and are not in the exclude list', async function () {
        const responseRequestTrialClient = await request(app).get('/request/trial');
        const trialClientId: string = responseRequestTrialClient.body.client;

        await Promise.all([
            request(app)
                .post('/node/register')
                .set('X-Rpch-Client', trialClientId)
                .send(mockNode('notExit1', false)),
            request(app)
                .post('/node/register')
                .set('X-Rpch-Client', trialClientId)
                .send(mockNode('notExit2', false)),
            request(app)
                .post('/node/register')
                .set('X-Rpch-Client', trialClientId)
                .send(mockNode('notExit3', false)),
            request(app)
                .post('/node/register')
                .set('X-Rpch-Client', trialClientId)
                .send(mockNode(UNSTABLE_NODE_PEERID, false)),
            request(app)
                .post('/node/register')
                .set('X-Rpch-Client', trialClientId)
                .send(mockNode('exit4', true)),
        ]);

        const allExitNodes = await request(app)
            .get(`/node?hasExitNode=${false}&excludeList=${UNSTABLE_NODE_PEERID}`)
            .set('X-Rpch-Client', trialClientId);

        assert.equal(allExitNodes.body.length, 3);
        assert.equal(
            allExitNodes.body.findIndex((node: any) => node.id === UNSTABLE_NODE_PEERID),
            -1
        );
    });

    it('should get all nodes that are exit node and stable', async function () {
        const responseRequestTrialClient = await request(app).get('/request/trial');
        const trialClientId: string = responseRequestTrialClient.body.client;

        await Promise.all([
            request(app)
                .post('/node/register')
                .set('X-Rpch-Client', trialClientId)
                .send(mockNode('notExit1', false)),
            request(app)
                .post('/node/register')
                .set('X-Rpch-Client', trialClientId)
                .send(mockNode('notExit2', false)),
            request(app)
                .post('/node/register')
                .set('X-Rpch-Client', trialClientId)
                .send(mockNode('exit3', true)),
            request(app)
                .post('/node/register')
                .set('X-Rpch-Client', trialClientId)
                .send(mockNode('exit4', true)),
            request(app)
                .post('/node/register')
                .set('X-Rpch-Client', trialClientId)
                .send(mockNode(UNSTABLE_NODE_PEERID, true)),
        ]);

        const allExitNodes = await request(app)
            .get(`/node?hasExitNode=true`)
            .set('X-Rpch-Client', trialClientId);

        assert.equal(allExitNodes.body.length, 2);
    });

    it('should add quota to a client', async function () {
        const createdQuota = await request(app)
            .post('/client/quota')
            .send({
                client: 'client',
                quota: 1,
            })
            .set('x-secret-key', SECRET);

        assert.equal(createdQuota.body.quota.quota, 1);
    });

    it('should not add quota to a client if secret is missing or incorrect', async function () {
        const createdQuotaWithoutSecret = await request(app).post('/client/quota').send({
            client: 'client',
            quota: 1,
        });

        const createdQuotaWithWrongSecret = await request(app)
            .post('/client/quota')
            .send({
                client: 'client',
                quota: 1,
            })
            .set('x-secret-key', 'wrong');

        assert.equal(createdQuotaWithoutSecret.status, 400);
        assert.equal(createdQuotaWithWrongSecret.status, 400);
    });

    it('should delete registered node', async function () {
        const node = mockNode();
        const responseRequestTrialClient = await request(app).get('/request/trial');
        const trialClientId: string = responseRequestTrialClient.body.client;
        await request(app).post('/node/register').set('X-Rpch-Client', trialClientId).send(node);
        const deletedNode = await request(app)
            .delete(`/request/entry-node/${node.peerId}`)
            .set('X-Rpch-Client', trialClientId)
            .set('x-secret-key', SECRET);
        const queryDeletedNode = await request(app)
            .get(`/node/${node.peerId}`)
            .set('X-Rpch-Client', trialClientId);

        assert.equal(queryDeletedNode.status, 500);
        assert.equal(deletedNode.status, 200);
        assert.equal(deletedNode.body.node.id, node.peerId);
    });

    it('should not delete registered node if secret is missing or incorrect', async function () {
        const deletedNodeWithoutSecret = await request(app).delete('/request/entry-node/123').send({
            client: 'client',
            quota: 1,
        });

        const deletedNodeWithWrongSecret = await request(app)
            .delete('/request/entry-node/123')
            .send({
                client: 'client',
                quota: 1,
            })
            .set('x-secret-key', 'wrong');

        assert.equal(deletedNodeWithoutSecret.status, 400);
        assert.equal(deletedNodeWithWrongSecret.status, 400);
    });

    it('should create trial client', async function () {
        const responseRequestTrialClient = await request(app).get('/request/trial');
        const trialClientId: string = responseRequestTrialClient.body.client;

        const response = await request(app)
            .get('/request/trial?label=devcon,some-dash')
            .set('X-Rpch-Client', trialClientId);
        const dbClient = await getClient(dbInstance.db, response.body.client);
        assert.equal(dbClient?.payment, 'trial');
        assert.deepEqual(dbClient?.labels, ['devcon', 'some-dash']);
        assert.equal(!!response.body.client, true);
    });

    it('should turn client into premium when adding quota', async function () {
        const spy = jest.spyOn(registeredNode, 'getEligibleNode');

        const responseRequestTrialClient = await request(app).get('/request/trial');
        const trialClientId: string = responseRequestTrialClient.body.client;

        await request(app)
            .post('/client/quota')
            .send({ client: trialClientId, quota: BASE_QUOTA.toString() })
            .set('x-secret-key', SECRET);

        const dbTrialClientAfterAddingQuota = await getClient(dbInstance.db, trialClientId);

        expect(dbTrialClientAfterAddingQuota?.payment).toEqual('premium');
        spy.mockRestore();
    });

    describe('should select an entry node', function () {
        it('should return an entry node', async function () {
            const spy = jest.spyOn(registeredNode, 'getEligibleNode');
            const peerId = 'entry';
            const responseRequestTrialClient = await request(app).get('/request/trial');
            const trialClientId: string = responseRequestTrialClient.body.client;

            await request(app)
                .post('/client/quota')
                .send({
                    client: trialClientId,
                    quota: BigInt('1').toString(),
                })
                .set('x-secret-key', SECRET);

            await request(app)
                .post('/node/register')
                .set('X-Rpch-Client', trialClientId)
                .send(mockNode(peerId, true));

            const createdNode: {
                body: { node: RegisteredNodeDB | undefined };
            } = await request(app).get(`/node/${peerId}`).set('X-Rpch-Client', trialClientId);

            spy.mockImplementation(async () => {
                return createdNode.body.node;
            });

            const requestResponse = await request(app)
                .post('/request/entry-node')
                .set('X-Rpch-Client', trialClientId);

            assert.equal(requestResponse.body.id, createdNode.body.node?.id);
            spy.mockRestore();
        });
        it('should return an entry node that is not in the exclude list', async function () {
            const peerId = 'entry';
            const secondPeerId = 'secondEntry';
            const responseRequestTrialClient = await request(app).get('/request/trial');
            const trialClientId: string = responseRequestTrialClient.body.client;

            await request(app)
                .post('/client/quota')
                .send({
                    client: trialClientId,
                    quota: 1,
                })
                .set('x-secret-key', SECRET);

            // register entry nodes to discovery platform
            await request(app)
                .post('/node/register')
                .set('X-Rpch-Client', trialClientId)
                .send(mockNode(peerId, true));

            await request(app)
                .post('/node/register')
                .set('X-Rpch-Client', trialClientId)
                .send(mockNode(secondPeerId, true));

            await request(app)
                .post('/node/register')
                .set('X-Rpch-Client', trialClientId)
                .send(mockNode(UNSTABLE_NODE_PEERID, true));

            const firstCreatedNode: {
                body: { node: RegisteredNodeDB | undefined };
            } = await request(app).get(`/node/${peerId}`).set('X-Rpch-Client', trialClientId);

            const secondCreatedNode: {
                body: { node: RegisteredNodeDB | undefined };
            } = await request(app).get(`/node/${secondPeerId}`).set('X-Rpch-Client', trialClientId);

            const unstableCreatedNode: {
                body: { node: RegisteredNodeDB | undefined };
            } = await request(app)
                .get(`/node/${UNSTABLE_NODE_PEERID}`)
                .set('X-Rpch-Client', trialClientId);

            // update created registered nodes to ready state
            // so they are eligible to be chosen
            await registeredNode.updateRegisteredNode(dbInstance.db, {
                ...firstCreatedNode.body.node!,
                status: 'READY',
            });
            await registeredNode.updateRegisteredNode(dbInstance.db, {
                ...secondCreatedNode.body.node!,
                status: 'READY',
            });
            await registeredNode.updateRegisteredNode(dbInstance.db, {
                ...unstableCreatedNode.body.node!,
                status: 'READY',
            });

            // exclude first entry node and unstable node
            const requestResponse = await request(app)
                .post('/request/entry-node')
                .set('X-Rpch-Client', trialClientId)
                .send({ excludeList: [UNSTABLE_NODE_PEERID, peerId] });

            assert.equal(requestResponse.status, 200);
            assert.equal(requestResponse.body.id, secondCreatedNode.body.node?.id);
        });
        it('should return 404 when all entry nodes are on exclude list', async function () {
            const peerId = 'entry';
            const secondPeerId = 'secondEntry';
            const responseRequestTrialClient = await request(app).get('/request/trial');
            const trialClientId: string = responseRequestTrialClient.body.client;

            await request(app)
                .post('/client/quota')
                .send({
                    client: trialClientId,
                    quota: 1,
                })
                .set('x-secret-key', SECRET);

            // register entry nodes to discovery platform
            await request(app)
                .post('/node/register')
                .set('X-Rpch-Client', trialClientId)
                .send(mockNode(peerId, true));

            await request(app)
                .post('/node/register')
                .set('X-Rpch-Client', trialClientId)
                .send(mockNode(secondPeerId, true));

            // This node is automatically added to the exclude list
            // because of availability monitor mock
            await request(app)
                .post('/node/register')
                .set('X-Rpch-Client', trialClientId)
                .send(mockNode(UNSTABLE_NODE_PEERID, true));

            const firstCreatedNode: {
                body: { node: RegisteredNodeDB | undefined };
            } = await request(app).get(`/node/${peerId}`).set('X-Rpch-Client', trialClientId);

            const secondCreatedNode: {
                body: { node: RegisteredNodeDB | undefined };
            } = await request(app).get(`/node/${secondPeerId}`).set('X-Rpch-Client', trialClientId);

            // update created registered nodes to ready state
            // so they are eligible to be chosen
            await registeredNode.updateRegisteredNode(dbInstance.db, {
                ...firstCreatedNode.body.node!,
                status: 'READY',
            });
            await registeredNode.updateRegisteredNode(dbInstance.db, {
                ...secondCreatedNode.body.node!,
                status: 'READY',
            });

            // exclude all available nodes
            const requestResponse = await request(app)
                .post('/request/entry-node')
                .set('X-Rpch-Client', trialClientId)
                .send({ excludeList: [peerId, secondPeerId] });

            assert.equal(requestResponse.status, 404);
            assert.deepEqual(requestResponse.body, {
                errors: 'Could not find eligible node',
            });
        });
        it('should return an entry node when adding recently received node was put on the exclude list in a subsequent call', async function () {
            const peerId = 'entry';
            const secondPeerId = 'secondEntry';
            const thirdPeerId = 'thirdEntry';
            const responseRequestTrialClient = await request(app).get('/request/trial');
            const trialClientId: string = responseRequestTrialClient.body.client;

            await request(app)
                .post('/client/quota')
                .send({
                    client: trialClientId,
                    quota: 1,
                })
                .set('x-secret-key', SECRET);

            // register entry nodes to discovery platform
            await request(app)
                .post('/node/register')
                .set('X-Rpch-Client', trialClientId)
                .send(mockNode(peerId, true));

            await request(app)
                .post('/node/register')
                .set('X-Rpch-Client', trialClientId)
                .send(mockNode(secondPeerId, true));

            await request(app)
                .post('/node/register')
                .set('X-Rpch-Client', trialClientId)
                .send(mockNode(thirdPeerId, true));

            // This node is automatically added to the exclude list
            // because of availability monitor mock
            await request(app)
                .post('/node/register')
                .set('X-Rpch-Client', trialClientId)
                .send(mockNode(UNSTABLE_NODE_PEERID, true));

            const firstCreatedNode: {
                body: { node: RegisteredNodeDB | undefined };
            } = await request(app).get(`/node/${peerId}`).set('X-Rpch-Client', trialClientId);

            const secondCreatedNode: {
                body: { node: RegisteredNodeDB | undefined };
            } = await request(app).get(`/node/${secondPeerId}`).set('X-Rpch-Client', trialClientId);

            const thirdCreatedNode: {
                body: { node: RegisteredNodeDB | undefined };
            } = await request(app).get(`/node/${thirdPeerId}`).set('X-Rpch-Client', trialClientId);

            // update created registered nodes to ready state
            // so they are eligible to be chosen
            await registeredNode.updateRegisteredNode(dbInstance.db, {
                ...firstCreatedNode.body.node!,
                status: 'READY',
            });
            await registeredNode.updateRegisteredNode(dbInstance.db, {
                ...secondCreatedNode.body.node!,
                status: 'READY',
            });
            await registeredNode.updateRegisteredNode(dbInstance.db, {
                ...thirdCreatedNode.body.node!,
                status: 'READY',
            });

            // exclude first entry node, should receive second or third entry node
            const requestResponse = await request(app)
                .post('/request/entry-node')
                .set('X-Rpch-Client', trialClientId)
                .send({ excludeList: [peerId] });

            // test received node is not the node passed in exclude list
            assert.equal(requestResponse.status, 200);
            assert.notEqual(requestResponse.body.id, peerId);

            // exclude first entry node and the subsequent node that was received
            const secondRequestResponse = await request(app)
                .post('/request/entry-node')
                .set('X-Rpch-Client', trialClientId)
                .send({ excludeList: [peerId, requestResponse.body.id] });

            // test a node was received
            assert.equal(requestResponse.status, 200);
            // test the node received was not part of exclude list
            assert.notEqual(secondRequestResponse.body.id, peerId);
            assert.notEqual(secondRequestResponse.body.id, requestResponse.body.id);
        });
        it('should fail if no entry node is selected', async function () {
            const spy = jest.spyOn(registeredNode, 'getEligibleNode');

            const responseRequestTrialClient = await request(app).get('/request/trial');
            const trialClientId: string = responseRequestTrialClient.body.client;

            await request(app)
                .post('/client/quota')
                .send({
                    client: trialClientId,
                    quota: 1,
                })
                .set('x-secret-key', SECRET);

            spy.mockImplementation(async () => undefined);

            const requestResponse = await request(app)
                .post('/request/entry-node')
                .set('X-Rpch-Client', trialClientId);

            assert.equal(requestResponse.body.errors, 'Could not find eligible node');
            spy.mockRestore();
        });
        it.skip('should reduce client quota', async function () {
            const spyGetEligibleNode = jest.spyOn(registeredNode, 'getEligibleNode');
            const peerId = 'entry';

            const responseRequestTrialClient = await request(app).get('/request/trial');
            const trialClientId: string = responseRequestTrialClient.body.client;

            // add quota to newClient
            await request(app)
                .post('/client/quota')
                .send({
                    client: 'newClient',
                    quota: BASE_QUOTA.toString(),
                })
                .set('x-secret-key', SECRET);

            await request(app)
                .post('/node/register')
                .set('X-Rpch-Client', trialClientId)
                .send(mockNode(peerId, true));

            const createdNode: {
                body: { node: RegisteredNodeDB | undefined };
            } = await request(app).get(`/node/${peerId}`).set('X-Rpch-Client', trialClientId);

            spyGetEligibleNode.mockImplementation(async () => {
                return createdNode.body.node;
            });

            // use quota twice expecting the second time for it to fail
            await request(app).post('/request/entry-node').set('X-Rpch-Client', trialClientId);

            const requestResponse = await request(app)
                .post('/request/entry-node')
                .set('X-Rpch-Client', trialClientId);

            assert.equal(requestResponse.body.body, 'Client does not have enough quota');

            spyGetEligibleNode.mockRestore();
        });
        // ENABLE once we start counting quota in `/request/entry-node`
        it.skip('should be able to use trial mode client and reduce quota', async function () {
            const spyGetEligibleNode = jest.spyOn(registeredNode, 'getEligibleNode');
            const peerId = 'entry';

            const responseRequestTrialClient = await request(app).get('/request/trial');
            const trialClientId: string = responseRequestTrialClient.body.client;

            await request(app)
                .post('/client/quota')
                .send({
                    client: 'trial',
                    quota: BASE_QUOTA.toString(),
                })
                .set('x-secret-key', SECRET);

            await request(app)
                .post('/node/register')
                .set('X-Rpch-Client', trialClientId)
                .send(mockNode(peerId, true));

            const createdNode: {
                body: { node: RegisteredNodeDB | undefined };
            } = await request(app).get(`/node/${peerId}`).set('X-Rpch-Client', trialClientId);

            spyGetEligibleNode.mockImplementation(async () => {
                return createdNode.body.node;
            });

            const trialClientQuotaBefore = await getSumOfQuotasPaidByClient(dbInstance.db, 'trial');

            const requestResponse = await request(app)
                .post('/request/entry-node')
                .set('X-Rpch-Client', trialClientId);

            const trialClientQuotaAfter = await getSumOfQuotasPaidByClient(dbInstance.db, 'trial');

            expect(trialClientQuotaAfter).toBeLessThan(trialClientQuotaBefore);
            expect(requestResponse.body).toHaveProperty('id');

            spyGetEligibleNode.mockRestore();
        });
    });

    describe('should not select unstable entry node', function () {
        it('should not return an entry node', async function () {
            // this peerId will be added to exclude list
            // automatically because of the availability monitor mock
            const peerId = UNSTABLE_NODE_PEERID;
            const responseRequestTrialClient = await request(app).get('/request/trial');
            const trialClientId: string = responseRequestTrialClient.body.client;

            await request(app)
                .post('/client/quota')
                .send({
                    client: trialClientId,
                    quota: BigInt('1').toString(),
                })
                .set('x-secret-key', SECRET);

            await request(app)
                .post('/node/register')
                .set('X-Rpch-Client', trialClientId)
                .send(mockNode(peerId, true));

            await request(app).get(`/node/${peerId}`).set('X-Rpch-Client', trialClientId);

            const requestResponse = await request(app)
                .post('/request/entry-node')
                .set('X-Rpch-Client', trialClientId);

            assert.equal(requestResponse.statusCode, 404);
        });
    });
});
