import * as utils from './utils';
import * as Res from './result';
import { utils as ethersUtils } from 'ethers';

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

    it('converts hex string to uint8arrays', function () {
        const key = '0x02bcfc5bbf82f1f49630de86a4c19c0b46a0ba3eaf163a9f347c2a1fc526435226';

        const keyArr1 = utils.hexStringToUint8Array(key);
        const keyArr2 = ethersUtils.arrayify(key);

        expect(keyArr1).toEqual(keyArr2);
    });
});
