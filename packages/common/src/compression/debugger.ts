/* eslint-disable */
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
import { utils } from "ethers";

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
  let toUtf8Bytes = utils.toUtf8Bytes(resultCompressed);

  console.log("resultCompressed length", resultCompressed.length);
  console.log("toUtf8Bytes length", toUtf8Bytes.length);
  // const result = await Compression.decompressRpcRequestAsync(resultCompressed);

  return;
}

// JSON.stringify(res_80kb) length 80884
// LZString.compress(jsonTmp) resultCompressed length 1289
// LZString.compressToUTF16(jsonTmp) resultCompressed length 1375
// LZString.compressToEncodedURIComponent(jsonTmp); resultCompressed length 3420
// LZString.compressToUint8Array(jsonTmp); resultCompressed length 9168 (2558 Uinit8Array)
