import assert from "assert";
import _ from "lodash";
import Compression from ".";
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
} from "./compression-samples";

describe("test compression.ts / compress and decompress RpcRequest Async", function () {
  it("should return true", async function () {
    const compressed: string = await Compression.compressRpcRequestAsync(
      res_normal
    );
    const decompressed: any = await Compression.decompressRpcRequestAsync(
      compressed
    );
    const test = _.isEqual(res_normal, decompressed);
    assert(test);
  });

  it("should return true", async function () {
    const compressed: string = await Compression.compressRpcRequestAsync(
      res_compress_key_problem0
    );
    const decompressed: any = await Compression.decompressRpcRequestAsync(
      compressed
    );
    const test = _.isEqual(res_compress_key_problem0, decompressed);
    assert(test);
  });

  it("should return true", async function () {
    const compressed: string = await Compression.compressRpcRequestAsync(
      res_compress_key_problem1
    );
    const decompressed: any = await Compression.decompressRpcRequestAsync(
      compressed
    );
    const test = _.isEqual(res_compress_key_problem1, decompressed);
    assert(test);
  });

  it("should return true", async function () {
    const compressed: string = await Compression.compressRpcRequestAsync(
      req_small_different_params
    );
    const decompressed: any = await Compression.decompressRpcRequestAsync(
      compressed
    );
    const test = _.isEqual(req_small_different_params, decompressed);
    assert(test);
  });

  it("should return true", async function () {
    const compressed: string = await Compression.compressRpcRequestAsync(
      req_small_different_params_and_cant_do_params
    );
    const decompressed: any = await Compression.decompressRpcRequestAsync(
      compressed
    );
    const test = _.isEqual(
      req_small_different_params_and_cant_do_params,
      decompressed
    );
    assert(test);
  });

  it("should return true", async function () {
    const compressed: string = await Compression.compressRpcRequestAsync(
      req_small_cant_do_main_keys
    );
    const decompressed: any = await Compression.decompressRpcRequestAsync(
      compressed
    );
    const test = _.isEqual(req_small_cant_do_main_keys, decompressed);
    assert(test);
  });

  it("should return true", async function () {
    const compressed: string = await Compression.compressRpcRequestAsync(
      res_80kb
    );
    const decompressed: any = await Compression.decompressRpcRequestAsync(
      compressed
    );
    const test = _.isEqual(res_80kb, decompressed);
    assert(test);
  });

  it("should return true", async function () {
    const compressed: string = await Compression.compressRpcRequestAsync(
      res_error
    );
    const decompressed: any = await Compression.decompressRpcRequestAsync(
      compressed
    );
    const test = _.isEqual(res_error, decompressed);
    assert(test);
  });

  it("should return true", async function () {
    const compressed: string = await Compression.compressRpcRequestAsync(
      req_80kb
    );
    const decompressed: any = await Compression.decompressRpcRequestAsync(
      compressed
    );
    const test = _.isEqual(req_80kb, decompressed);
    assert(test);
  });

  it("should return true", async function () {
    const compressed: string = await Compression.compressRpcRequestAsync(
      res_80kb
    );
    const decompressed: any = await Compression.decompressRpcRequestAsync(
      compressed
    );
    const test = _.isEqual(res_80kb, decompressed);
    assert(test);
  });
});
