import assert from "assert";
import { utils } from "ethers";
import {
  splitStrByBytes,
  isExpired,
  areAllSegmentsPresent,
  replaceInStringAt,
  isArray,
  isJsonObject,
  isArrayOfJsonObjects,
  isArrayWithAtLeastOneJsonObject,
  findCommonElement,
} from "../utils";
import { createMockedFlow } from "../fixtures";
import { req_80kb } from "../compression/compression-samples";

describe("test utils / splitStrByBytes", function () {
  it("should return 1 string", function () {
    const str = "helloworld";
    assert.equal(utils.toUtf8Bytes(str).byteLength, 10);
    assert.equal(splitStrByBytes(str, 10).length, 1);
  });
  it("should return 3 strings", function () {
    const str = "helloworldhelloworldhelloworld";
    assert.equal(utils.toUtf8Bytes(str).byteLength, 30);
    assert.equal(splitStrByBytes(str, 10).length, 3);
  });
});

describe("test utils / isExpired", function () {
  const createdAt = new Date("2022-09-28T00:00:00.000Z");
  const timeout = 10e3;
  const inFiveSecs = new Date(createdAt.valueOf() + 5e3);
  const inTenSecs = new Date(createdAt.valueOf() + 15e3);

  it("should return false after 5 seconds", function () {
    assert(!isExpired(timeout, inFiveSecs, createdAt));
  });
  it("should return true after 15 seconds", function () {
    assert(isExpired(timeout, inTenSecs, createdAt));
  });
});

describe("test utils / areAllSegmentsPresent", function () {
  it("should return true", async function () {
    const completeSegments = (
      await createMockedFlow(JSON.stringify(req_80kb)).next()
    ).value
      .toMessage()
      .toSegments();
    assert(areAllSegmentsPresent(completeSegments));
  });
  it("should return false", async function () {
    const completeSegments = (
      await createMockedFlow(JSON.stringify(req_80kb)).next()
    ).value
      .toMessage()
      .toSegments();
    const incompleteSegments = completeSegments.slice(1);
    assert(!areAllSegmentsPresent(incompleteSegments));
  });
});

describe("test utils / areAllSegmentsPresent", function () {
  it("should return true", async function () {
    const completeSegments = (
      await createMockedFlow(JSON.stringify(req_80kb)).next()
    ).value
      .toMessage()
      .toSegments();

    assert(areAllSegmentsPresent(completeSegments));
  });
  it("should return false", async function () {
    const completeSegments = (
      await createMockedFlow(JSON.stringify(req_80kb)).next()
    ).value
      .toMessage()
      .toSegments();
    const incompleteSegments = completeSegments.slice(1);

    assert(!areAllSegmentsPresent(incompleteSegments));
  });
});

describe("test utils / replaceInStringAt", function () {
  const string = "abcdef";
  const string2 = replaceInStringAt(string, 2, "x");

  it("should return true", function () {
    assert(string2 === "abxdef");
  });
});

describe("test utils / isArray", function () {
  const test0: any = "abcdef";
  const test1: any = [];
  const test2: any = {};
  const test0_res = isArray(test0);
  const test1_res = isArray(test1);
  const test2_res = isArray(test2);
  it("should return true", function () {
    assert(test1_res);
  });
  it("should return false", function () {
    assert(!(test0_res || test2_res));
  });
});

describe("test utils / isJsonObject", function () {
  const test0: any = "abcdef";
  const test1: any = [];
  const test2: any = {};
  const test0_res = isJsonObject(test0);
  const test1_res = isJsonObject(test1);
  const test2_res = isJsonObject(test2);
  it("should return true", function () {
    assert(test2_res);
  });
  it("should return false", function () {
    assert(!(test0_res || test1_res));
  });
});

describe("test utils / isArrayOfJsonObjects", function () {
  const test0: any = "abcdef";
  const test1: any = [];
  const test2: any = {};
  const test3: any = { a: "b", c: "d" };
  const test4: any = { a: { a: "b", c: "d" }, c: { a: "b", c: "d" } };
  const test5: any = ["a", "b"];
  const test6: any = [
    { a: "b", c: "d" },
    { a: "b", c: "d" },
  ];
  const test7: any = ["string", { a: "b", c: "d" }];
  const test0_res = isArrayOfJsonObjects(test0);
  const test1_res = isArrayOfJsonObjects(test1);
  const test2_res = isArrayOfJsonObjects(test2);
  const test3_res = isArrayOfJsonObjects(test3);
  const test4_res = isArrayOfJsonObjects(test4);
  const test5_res = isArrayOfJsonObjects(test5);
  const test6_res = isArrayOfJsonObjects(test6);
  const test7_res = isArrayOfJsonObjects(test7);
  it("should return true", function () {
    assert(test6_res);
  });
  it("should return false", function () {
    assert(
      !(
        test0_res ||
        test1_res ||
        test2_res ||
        test3_res ||
        test4_res ||
        test5_res ||
        test7_res
      )
    );
  });
});

describe("test utils / isArrayWithAtLeastOneJsonObject", function () {
  const test0: any = "abcdef";
  const test1: any = [];
  const test2: any = {};
  const test3: any = { a: "b", c: "d" };
  const test4: any = { a: { a: "b", c: "d" }, c: { a: "b", c: "d" } };
  const test5: any = ["a", "b"];
  const test6: any = [
    { a: "b", c: "d" },
    { a: "b", c: "d" },
  ];
  const test7: any = ["string", { a: "b", c: "d" }];
  const test0_res = isArrayWithAtLeastOneJsonObject(test0);
  const test1_res = isArrayWithAtLeastOneJsonObject(test1);
  const test2_res = isArrayWithAtLeastOneJsonObject(test2);
  const test3_res = isArrayWithAtLeastOneJsonObject(test3);
  const test4_res = isArrayWithAtLeastOneJsonObject(test4);
  const test5_res = isArrayWithAtLeastOneJsonObject(test5);
  const test6_res = isArrayWithAtLeastOneJsonObject(test6);
  const test7_res = isArrayWithAtLeastOneJsonObject(test7);
  it("should return true", function () {
    assert(test6_res && test7_res);
  });
  it("should return false", function () {
    assert(
      !(
        test0_res ||
        test1_res ||
        test2_res ||
        test3_res ||
        test4_res ||
        test5_res
      )
    );
  });
});

describe("test utils / findCommonElement", function () {
  const arr1: string[] = [];
  const arr2: string[] = ["a", "b", "c", "dd"];
  const arr3: string[] = ["e", "f", "g", "h"];
  const arr4: string[] = ["dd", "x", "y", "z"];
  const test0_res = findCommonElement(arr1, arr1); // false
  const test1_res = findCommonElement(arr1, arr2); // false
  const test2_res = findCommonElement(arr1, arr3); // false
  const test3_res = findCommonElement(arr2, arr4); // true
  const test4_res = findCommonElement(arr2, arr2); // true
  const test5_res = findCommonElement(arr2, arr3); // false
  const test6_res = findCommonElement(arr2, arr4); // true
  const test7_res = findCommonElement(arr3, arr4); // false
  it("should return true", function () {
    assert(test3_res && test4_res && test6_res);
  });
  it("should return false", function () {
    assert(!(test0_res || test1_res || test2_res || test5_res || test7_res));
  });
});
