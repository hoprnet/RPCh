import Compression from "./index";
import {
  res_normal,
  res_compress_key_problem0,
  res_compress_key_problem1,
  req_small_different_params,
  res_error,
  req_80kb,
  res_80kb,
} from "./compression-samples";

main();
async function main() {
  const now = Date.now();
  console.log(
    "JSON.stringify(res_80kb) length",
    JSON.stringify(res_80kb).length
  );
  console.log("repeat(10) length", JSON.stringify(res_80kb).repeat(10).length);
  const resultCompressed = await Compression.compressRpcRequestAsync(
    JSON.stringify(res_80kb)
  );
  const resultCompressed2 = await Compression.compressRpcRequestAsync(
    JSON.stringify(res_80kb).repeat(10)
  );
  console.log("resultCompressed length", resultCompressed.length);
  console.log("resultCompressed length 10", resultCompressed2.length);
  const result = await Compression.decompressRpcRequestAsync(resultCompressed);

  return;
}
