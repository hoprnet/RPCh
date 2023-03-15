import assert from "assert";
import { utils } from "ethers";
import { splitStrByBytes, isExpired, areAllSegmentsPresent } from "../utils";
import { createMockedFlow, RPC_REQ_LARGE } from "../fixtures";

describe("test utils / splitStrByBytes", function () {
  it("should return 1 string", function () {
    const str = "helloworld";

    const res = splitStrByBytes(str, 10);
    const expected = [ "helloworld" ];

    assert(res.every((str, i) => expected[i] === str))
  });
  it("should return 3 strings", function () {
    const str = "helloworldhelloworldhelloworld";

    assert.equal(utils.toUtf8Bytes(str).byteLength, 30);

    const res = splitStrByBytes(str, 10);
    const expected = ["helloworld", "helloworld", "helloworld"];

    assert(res.every((str, i) => expected[i] === str))
  });
  it("should respect Utf-8 character sizes", function () {
    const str = "A𝑨B𝑩C𝑪";

    const res = splitStrByBytes(str, 2);
    const expected = [ 'A', '𝑨', 'B', '𝑩', 'C', '𝑪' ];

    assert(res.every((str, i) => expected[i] === str))
  })
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
  const completeSegments = createMockedFlow(RPC_REQ_LARGE)
    .next()
    .value.toMessage()
    .toSegments();
  const incompleteSegments = completeSegments.slice(1);

  it("should return true", function () {
    assert(areAllSegmentsPresent(completeSegments));
  });
  it("should return false", function () {
    assert(!areAllSegmentsPresent(incompleteSegments));
  });
});
