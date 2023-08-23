import * as dicts from "./dictionaries";

describe("dictionaries", function () {
  it("has one-to-one reversable mappings", function () {
    const c = (
      dict: Record<string, string>,
      revDict: Record<string, string>
    ) => {
      Object.keys(dict).forEach((k: string) => {
        const v = dict[k];
        const rev = revDict[v];
        expect(rev).toBe(k);
      });
    };

    c(dicts.mainKeyCmprVal, dicts.mainKeyValCmpr);
    c(dicts.mainKeyValCmpr, dicts.mainKeyCmprVal);

    c(dicts.resultsOrParamsCmprVal, dicts.resultsOrParamsValCmpr);
    c(dicts.resultsOrParamsValCmpr, dicts.resultsOrParamsCmprVal);

    c(dicts.methodCmprVal, dicts.methodValCmpr);
    c(dicts.methodValCmpr, dicts.methodCmprVal);
  });
});
