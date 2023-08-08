import assert from "assert";
import Reviewer from "./reviewer";
import * as Prometheus from "prom-client";
import { MetricManager } from "@rpch/common/build/internal/metric-manager";
import {
  TestingDatabaseInstance,
  getTestingConnectionString,
} from "@rpch/common/build/internal/db";
import { wait } from "@rpch/common/build/fixtures";
import { NODE_A_DB, RESULT_A } from "./fixtures";

// mock review function -> always resolve with RESULT_A
jest.mock("./review", () => ({
  ...jest.requireActual("./review"),
  __esModule: true, // let it know this is ESM
  default: () => Promise.resolve(RESULT_A),
}));

// mock DB functions -> always resolve with NODE_A
jest.mock("./db", () => ({
  getRegisteredNode: () => Promise.resolve(NODE_A_DB),
  getRegisteredNodes: () => Promise.resolve([NODE_A_DB]),
}));

const register = new Prometheus.Registry();
const metricManager = new MetricManager(Prometheus, register, "test");

describe("test Reviewer", function () {
  let dbInstance: TestingDatabaseInstance;
  let reviewer: Reviewer;

  beforeAll(async function () {
    dbInstance = await TestingDatabaseInstance.create(
      getTestingConnectionString()
    );
    reviewer = new Reviewer(dbInstance.db, metricManager, 1000, 2);
    reviewer.start();
  });

  afterAll(async function () {
    reviewer.stop();
    await dbInstance.close();
  });

  afterEach(function () {
    jest.resetAllMocks();
  });

  it("should start queue", async function () {
    await wait(2e3);
    assert.equal(reviewer.results.size, 1);
  });
});
