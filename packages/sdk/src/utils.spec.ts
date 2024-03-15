import * as utils from './utils';
import * as Res from './result';

describe('test utils', function () {
    it('compares versions', function () {
        let res = utils.versionCompare('0.0.1', '1.1.0');
        Res.assertOk(res);
        expect(res.res).toBe(utils.VrsnCmp.MajorMismatch);
        res = utils.versionCompare('1.1.0', '0.0.1');
        Res.assertOk(res);
        expect(res.res).toBe(utils.VrsnCmp.MajorMismatch);
        res = utils.versionCompare('1.1.0', '1.1.0');
        Res.assertOk(res);
        expect(res.res).toBe(utils.VrsnCmp.Identical);
        res = utils.versionCompare('0.0.1', '0.0.3');
        Res.assertOk(res);
        expect(res.res).toBe(utils.VrsnCmp.PatchMismatch);
        res = utils.versionCompare('1.3.3', '1.4.0');
        Res.assertOk(res);
        expect(res.res).toBe(utils.VrsnCmp.MinorMismatch);
        res = utils.versionCompare('', '1.4.0');
        expect(Res.isErr(res));
    });
});
