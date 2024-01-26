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
        const privKey = '0xb2010c83baf6ca735f788448f7c119df8e8068bc07c6d9d9701375a406c520ef';
        const keyArr1 = utils.hexStringToUint8Array(privKey);
        const keyArr2 = ethersUtils.arrayify(privKey);
        expect(keyArr1).toEqual(keyArr2);
    });

    it('converts uint8array to UTF8string', function () {
        const hex =
            '0x313244334b6f6f574e65344e3269736137563454395968427875504362386a416451574d515853485273484158424b6741454e73';
        const keyArr1 = utils.hexStringToUint8Array(hex);
        const keyArr2 = ethersUtils.arrayify(hex);
        const keyStr1 = utils.uint8ArrayToUTF8String(keyArr1);
        const keyStr2 = ethersUtils.toUtf8String(keyArr2);

        expect(keyStr1).toEqual(keyStr2);
    });
});
