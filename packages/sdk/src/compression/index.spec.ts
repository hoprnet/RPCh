import _ from "lodash";
import * as Compression from ".";
import {
  res_normal,
  res_compress_key_problem0,
  res_compress_key_problem1,
  req_small_different_params,
  req_small_cant_do_main_keys,
  req_small_different_params_and_cant_do_params,
  res_error,
  req_80kb,
  res_80kb,
  req_small,
  res_small,
} from "./compression-samples";
import { compression } from "@rpch/common";

describe("test compression.ts / compress and decompress RpcRequest Async", function () {
  it("should return true", function () {
    const compressed = Compression.compressRpcRequest(res_normal);
    const res = Compression.decompressRpcRequest(compressed);
    expect(res.success).toBe(true);
    expect(res).toHaveProperty("json");
    if ("json" in res) {
      const test = _.isEqual(res_normal, res.json);
      expect(test).toBe(true);
    }
  });

  it("should return true", function () {
    const compressed = Compression.compressRpcRequest(
      res_compress_key_problem0
    );
    const res = Compression.decompressRpcRequest(compressed);
    expect(res.success).toBe(true);
    expect(res).toHaveProperty("json");
    if ("json" in res) {
      const test = _.isEqual(res_compress_key_problem0, res.json);
      expect(test).toBe(true);
    }
  });

  it("should return true", function () {
    const compressed = Compression.compressRpcRequest(
      res_compress_key_problem1
    );
    const res = Compression.decompressRpcRequest(compressed);
    expect(res.success).toBe(true);
    expect(res).toHaveProperty("json");
    if ("json" in res) {
      const test = _.isEqual(res_compress_key_problem1, res.json);
      expect(test).toBe(true);
    }
  });

  it("should return true", function () {
    const compressed = Compression.compressRpcRequest(
      req_small_different_params
    );
    const res = Compression.decompressRpcRequest(compressed);
    expect(res.success).toBe(true);
    expect(res).toHaveProperty("json");
    if ("json" in res) {
      const test = _.isEqual(req_small_different_params, res.json);
      expect(test).toBe(true);
    }
  });

  it("should return true", function () {
    const compressed = Compression.compressRpcRequest(
      req_small_different_params_and_cant_do_params
    );
    const res = Compression.decompressRpcRequest(compressed);
    expect(res.success).toBe(true);
    expect(res).toHaveProperty("json");
    if ("json" in res) {
      const test = _.isEqual(
        req_small_different_params_and_cant_do_params,
        res.json
      );
      expect(test).toBe(true);
    }
  });

  it("should return true", function () {
    const compressed = Compression.compressRpcRequest(
      req_small_cant_do_main_keys
    );
    const res = Compression.decompressRpcRequest(compressed);
    expect(res.success).toBe(true);
    expect(res).toHaveProperty("json");
    if ("json" in res) {
      const test = _.isEqual(req_small_cant_do_main_keys, res.json);
      expect(test).toBe(true);
    }
  });

  it("should return true", function () {
    const compressed = Compression.compressRpcRequest(res_80kb);
    const res = Compression.decompressRpcRequest(compressed);
    expect(res.success).toBe(true);
    expect(res).toHaveProperty("json");
    if ("json" in res) {
      const test = _.isEqual(res_80kb, res.json);
      expect(test).toBe(true);
    }
  });

  it("should return true", function () {
    const compressed = Compression.compressRpcRequest(res_error);
    const res = Compression.decompressRpcRequest(compressed);
    expect(res.success).toBe(true);
    expect(res).toHaveProperty("json");
    if ("json" in res) {
      const test = _.isEqual(res_error, res.json);
      expect(test).toBe(true);
    }
  });

  it("should return true", function () {
    const compressed = Compression.compressRpcRequest(req_80kb);
    const res = Compression.decompressRpcRequest(compressed);
    expect(res.success).toBe(true);
    expect(res).toHaveProperty("json");
    if ("json" in res) {
      const test = _.isEqual(req_80kb, res.json);
      expect(test).toBe(true);
    }
  });

  it("should return true", function () {
    const compressed = Compression.compressRpcRequest(res_80kb);
    const res = Compression.decompressRpcRequest(compressed);
    expect(res.success).toBe(true);
    expect(res).toHaveProperty("json");
    if ("json" in res) {
      const test = _.isEqual(res_80kb, res.json);
      expect(test).toBe(true);
    }
  });

  it("handles weird input correctly without crashing", function () {
    const res = Compression.decompressRpcRequest("0110000000Þ¡0");
    expect(res.success).toBe(false);
    expect(res).toHaveProperty("error");
    if ("error" in res) {
      expect(res.error).toBe("Unexpected end of MessagePack data");
    }
  });

  it("handles cross module compression correctly req", function () {
    const compressed = Compression.compressRpcRequest(req_small);
    const res = compression.decompressRpcRequest(compressed);
    expect(res).toMatchObject(req_small);
  });

  it("handles cross module compression correctly res", function () {
    const compressed = Compression.compressRpcRequest(res_small);
    const res = compression.decompressRpcRequest(compressed);
    expect(res).toMatchObject(res_small);
  });
});
