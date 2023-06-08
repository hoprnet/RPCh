import type Reviewer from "./reviewer";
import request from "supertest";
import assert from "assert";
import API from "./api";
import { MetricManager } from "@rpch/common/build/internal/metric-manager";
import * as Prometheus from "prom-client";
import { NODE_A as NODE, RESULT_A as RESULT } from "./fixtures";

const register = new Prometheus.Registry();
const metricManager = new MetricManager(Prometheus, register, "test");

describe("test entry server", function () {
  let reviewer: Reviewer;
  let api: ReturnType<typeof API>;

  beforeEach(function () {
    // mock Reviewer
    reviewer = {
      results: new Map(),
    } as Reviewer;
    api = API({
      metricManager: metricManager,
      reviewer: reviewer,
    });
  });

  afterEach(function () {
    jest.resetAllMocks();
  });

  it("should get reviewed nodes", async function () {
    // add nodes to reviewer
    reviewer.results.set(NODE.peerId, RESULT);

    // request nodes from the API
    const response = await request(api).get("/api/nodes");

    assert.deepEqual(response.body, Array.from(reviewer.results.entries()));
  });
});
