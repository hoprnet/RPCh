import * as Reliability from "./reliability";

describe("test reliability", function () {
  it("should track multiple requests correctly", function () {
    let res = Reliability.startRequest(Reliability.empty(), {
      entryId: "entry1",
      exitId: "exit1",
      requestId: 1,
    });
    if (!("rel" in res)) {
      throw new Error();
    }

    res = Reliability.startRequest(res.rel, {
      entryId: "entry2",
      exitId: "exit2",
      requestId: 2,
    });
    if (!("rel" in res)) {
      throw new Error();
    }

    res = Reliability.startRequest(res.rel, {
      entryId: "entry3",
      exitId: "exit3",
      requestId: 3,
    });
    if (!("rel" in res)) {
      throw new Error();
    }

    let rel = res.rel;
    expect(Reliability.isEmpty(rel)).toBe(false);

    for (let exitId of ["exit1", "exit2", "exit3"]) {
      expect(Reliability.isCurrentlySuccessful(rel, exitId)).toBe(false);
      expect(Reliability.isCurrentlyBusy(rel, exitId)).toBe(true);
    }

    res = Reliability.finishRequest(rel, {
      exitId: "exit2",
      requestId: 2,
      result: false,
    });
    if (!("rel" in res)) {
      throw new Error();
    }

    rel = res.rel;
    for (let exitId of ["exit1", "exit3"]) {
      expect(Reliability.isCurrentlySuccessful(rel, exitId)).toBe(false);
      expect(Reliability.isCurrentlyBusy(rel, exitId)).toBe(true);
    }
    expect(Reliability.isCurrentlySuccessful(rel, "exit2")).toBe(false);
    expect(Reliability.isCurrentlyBusy(rel, "exit2")).toBe(false);

    res = Reliability.finishRequest(rel, {
      exitId: "exit1",
      requestId: 1,
      result: true,
    });
    if (!("rel" in res)) {
      return;
    }

    res = Reliability.finishRequest(res.rel, {
      exitId: "exit3",
      requestId: 1,
      result: true,
    });
    if (!("rel" in res)) {
      throw new Error();
    }

    for (let exitId of ["exit1", "exit3"]) {
      expect(Reliability.isCurrentlySuccessful(rel, exitId)).toBe(true);
      expect(Reliability.isCurrentlyBusy(rel, exitId)).toBe(false);
    }
    expect(Reliability.isCurrentlySuccessful(rel, "exit2")).toBe(false);
    expect(Reliability.isCurrentlyBusy(rel, "exit2")).toBe(false);
  });

  it("should expire requests correctly", function () {
    let res = Reliability.startRequest(Reliability.empty(), {
      entryId: "entry1",
      exitId: "exit1",
      requestId: 1,
    });
    if (!("rel" in res)) {
      throw new Error();
    }

    res = Reliability.finishRequest(res.rel, {
      exitId: "exit1",
      requestId: 1,
      result: true,
    });
    if (!("rel" in res)) {
      throw new Error();
    }

    const rel = Reliability.expireOlderThan(res.rel, -1);
    expect(rel).toMatchObject(Reliability.empty());
  });
});
