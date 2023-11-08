import * as reqStore from './request-store';

let store: reqStore.RequestStore;

describe('RPCh request store', function () {
    beforeAll(async () => {
        // setup fluent database on disk
        store = await reqStore.setup('');
    });

    afterAll(async () => reqStore.close(store));

    it('addIfAbsent adds correctly', async function () {
        const res = await reqStore.addIfAbsent(store, 'foobar', Date.now());
        expect(res).toBe(reqStore.AddRes.Success);
    });

    it('addIfAbsent detects duplicates', async function () {
        await reqStore.addIfAbsent(store, 'foobar', Date.now());
        const res = await reqStore.addIfAbsent(store, 'foobar', Date.now());
        expect(res).toBe(reqStore.AddRes.Duplicate);
    });
});
