describe('test request cache', function () {
    it('generates uuid without crypto', function () {
        jest.doMock('crypto', () => {});
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const RequestCache = require('./request-cache');
        const rc = RequestCache.init();
        const res = RequestCache.generateId(rc);
        expect(res.length).toBe(36);
        jest.resetModules();
    });
});
