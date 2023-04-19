import { JSONObject, CompressedPayload, Dictionary } from "../types";

import {
  mainKeyMap,
  resultOrParamsKeyMap,
  methodValueMap,
} from "./dictionaries";

import { MAX_BYTES } from "../utils/index";

import * as utils from "../utils";
import { unpack, pack } from "msgpackr";
import JSZip from "jszip";
// @ts-ignore-start
import JSZipSync from "jszip-sync";
// @ts-ignore-end

// For testing
// import {
//   res_normal,
//   res_compress_key_problem0,
//   res_compress_key_problem1,
//   req_small_different_params,
//   res_error,
//   req_80kb,
//   res_80kb
// } from './index.spec'

/**
 * Functions used to compress and decompress RPC requests
 * The zeros in the 1st 5 places of the result mean:
 * 0 no.0 - the content is zipped
 * 0 no.1 - the content is msgpackr packed
 * 0 no.2 - main keys compressed
 * 0 no.3 - 'params'{} keys compressed
 * 0 no.4 - 'result'{} keys compressed
 * 0 no.5 - 'error'{} kets compressed
 * 0 no.6 - 'method' value compressed
 */

export default class Compression {
  public static async compressRpcRequestAsync(
    requestBody: JSONObject
  ): Promise<CompressedPayload> {
    let compressionDiagram: CompressedPayload = "0000000";
    let jsonTmp: JSONObject = JSON.parse(JSON.stringify(requestBody));
    // console.log('--Checks of sizes for comparation: --');
    // console.log('input size:', JSON.stringify(requestBody).length);
    // console.log("only msgpackr size:", pack(jsonTmp).length);

    // For testing:
    // let testZip = new JSZip();
    // testZip.file("msg", JSON.stringify(requestBody));
    // let testZipStr = await testZip.generateAsync({
    //   type: "string",
    //   compression: "DEFLATE",
    //   compressionOptions: {
    //     level: 9
    //   }
    // })
    // console.log("only zip size:", testZipStr.length);

    // testZip.file("msg", pack(jsonTmp));
    // testZipStr = await testZip.generateAsync({
    //   type: "string",
    //   compression: "DEFLATE",
    //   compressionOptions: {
    //     level: 9
    //   }
    // })
    // console.log("msgpackr and zip size:", testZipStr.length);

    //console.log('\n\n--Sizes of input after each consecutive type of compression: --');
    //Compress 'method' Value
    let result = Compression.compressRPCMethodValue(jsonTmp);
    if (result.compressed) {
      compressionDiagram = Compression.compressionDiagramUpdate(
        compressionDiagram,
        6,
        true
      );
      jsonTmp = result.json;
    }
    // console.log("Compress 'method' Value size:", JSON.stringify(jsonTmp).length);

    //Compress 'result'{} keys
    result = Compression.compressRPCSomeObjectKeys(jsonTmp, "result");
    if (result.compressed) {
      compressionDiagram = Compression.compressionDiagramUpdate(
        compressionDiagram,
        4,
        true
      );
      jsonTmp = result.json;
    }
    // console.log("Compress 'result'{} keys size:", JSON.stringify(jsonTmp).length);

    //Compress 'params'{} keys
    result = Compression.compressRPCSomeObjectKeys(jsonTmp, "params");
    if (result.compressed) {
      compressionDiagram = Compression.compressionDiagramUpdate(
        compressionDiagram,
        3,
        true
      );
      jsonTmp = result.json;
    }
    // console.log("Compress 'params'{} keys size:", JSON.stringify(jsonTmp).length);

    //Compress 'error'{} keys
    result = Compression.compressRPCSomeObjectKeys(jsonTmp, "error");
    if (result.compressed) {
      compressionDiagram = Compression.compressionDiagramUpdate(
        compressionDiagram,
        5,
        true
      );
      jsonTmp = result.json;
    }
    // console.log("Compress 'error'{} keys size:", JSON.stringify(jsonTmp).length);

    //Compress main keys
    result = Compression.compressRPCMainObjectKeys(jsonTmp);
    if (result.compressed) {
      compressionDiagram = Compression.compressionDiagramUpdate(
        compressionDiagram,
        2,
        true
      );
      jsonTmp = result.json;
    }
    // console.log("Compress 'main'{} keys size:", JSON.stringify(jsonTmp).length);

    //Compress msgpackr
    jsonTmp = pack(jsonTmp);
    jsonTmp = jsonTmp.toString("binary"); //  'ucs2', 'base64' and 'binary' also work https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
    compressionDiagram = Compression.compressionDiagramUpdate(
      compressionDiagram,
      1,
      true
    );
    // console.log("Compress msgpackr size:", jsonTmp.length);

    if (jsonTmp.length > MAX_BYTES - 10) {
      let zip = new JSZip();
      zip.file("msg", jsonTmp);

      const zipped = await zip.generateAsync({
        type: "string",
        compression: "DEFLATE",
        compressionOptions: {
          level: 9,
        },
      });
      //console.log("Compress jszip size:", zipped.length);

      if (zipped.length < jsonTmp.length) {
        jsonTmp = zipped as string;
        compressionDiagram = Compression.compressionDiagramUpdate(
          compressionDiagram,
          0,
          true
        );
      }
    }
    // @ts-ignore-start
    return compressionDiagram + jsonTmp;
    // @ts-ignore-end
  }

  public static compressRpcRequestSync(
    requestBody: JSONObject
  ): CompressedPayload {
    let compressionDiagram: CompressedPayload = "0000000";
    let jsonTmp: JSONObject = JSON.parse(JSON.stringify(requestBody));
    let result = Compression.compressRPCMethodValue(jsonTmp);
    if (result.compressed) {
      compressionDiagram = Compression.compressionDiagramUpdate(
        compressionDiagram,
        6,
        true
      );
      jsonTmp = result.json;
    }

    //Compress 'result'{} keys
    result = Compression.compressRPCSomeObjectKeys(jsonTmp, "result");
    if (result.compressed) {
      compressionDiagram = Compression.compressionDiagramUpdate(
        compressionDiagram,
        4,
        true
      );
      jsonTmp = result.json;
    }

    //Compress 'params'{} keys
    result = Compression.compressRPCSomeObjectKeys(jsonTmp, "params");
    if (result.compressed) {
      compressionDiagram = Compression.compressionDiagramUpdate(
        compressionDiagram,
        3,
        true
      );
      jsonTmp = result.json;
    }

    //Compress 'error'{} keys
    result = Compression.compressRPCSomeObjectKeys(jsonTmp, "error");
    if (result.compressed) {
      compressionDiagram = Compression.compressionDiagramUpdate(
        compressionDiagram,
        5,
        true
      );
      jsonTmp = result.json;
    }

    //Compress main keys
    result = Compression.compressRPCMainObjectKeys(jsonTmp);
    if (result.compressed) {
      compressionDiagram = Compression.compressionDiagramUpdate(
        compressionDiagram,
        2,
        true
      );
      jsonTmp = result.json;
    }

    //Compress msgpackr
    jsonTmp = pack(jsonTmp);
    jsonTmp = jsonTmp.toString("binary"); //  'ucs2', 'base64' and 'binary' also work https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
    compressionDiagram = Compression.compressionDiagramUpdate(
      compressionDiagram,
      1,
      true
    );

    if (jsonTmp.length > MAX_BYTES - 10) {
      let zip = new JSZipSync();
      zip.file("msg", jsonTmp);

      let zipped = zip.sync(function () {
        const zipped = zip
          .generateAsync({
            type: "string",
            compression: "DEFLATE",
            compressionOptions: {
              level: 9,
            },
          })
          .then(function (content: any) {
            return content;
          });

        return zipped;
      });

      if (zipped.length < jsonTmp.length) {
        jsonTmp = zipped;
        compressionDiagram = Compression.compressionDiagramUpdate(
          compressionDiagram,
          0,
          true
        );
      }
    }

    // @ts-ignore-start
    return compressionDiagram + jsonTmp;
    // @ts-ignore-end
  }

  public static async decompressRpcRequestAsync(
    compressedBody: string
  ): Promise<JSONObject> {
    // @ts-ignore-start
    let compressionDiagram: CompressedPayload = compressedBody.substring(0, 7);
    // @ts-ignore-end
    let jsonTmp: JSONObject = compressedBody.substring(7);

    if (compressionDiagram[0] === "1") {
      jsonTmp = await JSZip.loadAsync(jsonTmp)
        .then(function (zip) {
          // @ts-ignore-start
          return zip.file("msg").async("text");
          // @ts-ignore-end
        })
        .then(function (txt) {
          return txt;
        });
    }

    if (compressionDiagram[1] === "1") {
      const msgpackrBuffer = Buffer.from(jsonTmp, "binary");
      jsonTmp = unpack(msgpackrBuffer);
    }

    if (compressionDiagram[2] === "1") {
      jsonTmp = Compression.decompressRPCMainObjectKeys(jsonTmp);
    }

    if (compressionDiagram[5] === "1") {
      jsonTmp = Compression.decompressRPCSomeObjectKeys(jsonTmp, "error");
    }

    if (compressionDiagram[4] === "1") {
      jsonTmp = Compression.decompressRPCSomeObjectKeys(jsonTmp, "result");
    }

    if (compressionDiagram[3] === "1") {
      jsonTmp = Compression.decompressRPCSomeObjectKeys(jsonTmp, "params");
    }

    if (compressionDiagram[6] === "1") {
      jsonTmp = Compression.decompressRPCMethodValue(jsonTmp);
    }

    return jsonTmp;
  }

  public static decompressRpcRequestSync(compressedBody: string): JSONObject {
    // @ts-ignore-start
    let compressionDiagram: CompressedPayload = compressedBody.substring(0, 7);
    let jsonTmp: JSONObject = compressedBody.substring(7);
    if (compressionDiagram[0] === "1") {
      let zip = new JSZipSync();
      jsonTmp = zip.sync(function () {
        var data = JSZip.loadAsync(jsonTmp)

          .then(function (zip: any) {
            return zip.file("msg").async("text");
          })
          .then(function (txt: any) {
            return txt;
          });
        return data;
      });
    }
    // @ts-ignore-end

    if (compressionDiagram[1] === "1") {
      const msgpackrBuffer = Buffer.from(jsonTmp, "binary");
      jsonTmp = unpack(msgpackrBuffer);
    }

    if (compressionDiagram[2] === "1") {
      jsonTmp = Compression.decompressRPCMainObjectKeys(jsonTmp);
    }

    if (compressionDiagram[5] === "1") {
      jsonTmp = Compression.decompressRPCSomeObjectKeys(jsonTmp, "error");
    }

    if (compressionDiagram[4] === "1") {
      jsonTmp = Compression.decompressRPCSomeObjectKeys(jsonTmp, "result");
    }

    if (compressionDiagram[3] === "1") {
      jsonTmp = Compression.decompressRPCSomeObjectKeys(jsonTmp, "params");
    }

    if (compressionDiagram[6] === "1") {
      jsonTmp = Compression.decompressRPCMethodValue(jsonTmp);
    }

    return jsonTmp;
  }

  private static getCompressedKeyId(
    key: string,
    dictionary: Dictionary
  ): string | null | PropertyKey {
    let id = null;
    const dictionaryKeys: string[] = Object.keys(dictionary);

    for (let i = 0; i < dictionaryKeys.length; i++) {
      if (key === dictionary[dictionaryKeys[i]]) {
        id = dictionaryKeys[i];
        break;
      }
    }

    return id;
  }

  private static getDecompressedKeyId(
    key: string,
    dictionary: Dictionary
  ): string | null | PropertyKey {
    return dictionary[key];
  }

  private static compressRPCMethodValue(input: JSONObject): JSONObject {
    let result: JSONObject = {
      compressed: false,
      json: JSON.parse(JSON.stringify(input)),
    };

    if (input["method"]) {
      const method: string = input["method"];
      const methodId = Compression.getCompressedKeyId(method, methodValueMap);
      if (methodId) {
        result.json["method"] = methodId;
        result.compressed = true;
      }
    }

    return result;
  }

  private static decompressRPCMethodValue(input: JSONObject): JSONObject {
    let result: JSONObject = JSON.parse(JSON.stringify(input));
    const methodId: string = input["method"];
    const methodName = Compression.getDecompressedKeyId(
      methodId,
      methodValueMap
    );
    result["method"] = methodName;
    return result;
  }

  //  TODO: In future we could use recurrence here
  private static compressRPCSomeObjectKeys(
    input: JSONObject,
    objectKey: string
  ): JSONObject {
    let result: JSONObject = {
      compressed: false,
      json: JSON.parse(JSON.stringify(input)),
    };

    if (!input[objectKey]) return result;

    const isArray = utils.isArray(input[objectKey]);
    const isObject = utils.isJsonObject(input[objectKey]);
    if (!isArray && !isObject) return result;

    const dictionaryKeys: string[] = Object.keys(resultOrParamsKeyMap);
    const isArrayWithAtLeastOneJsonObject =
      utils.isArrayWithAtLeastOneJsonObject(input[objectKey]);
    if (isArrayWithAtLeastOneJsonObject) {
      //check if new keys do not create conflicts with old keys
      let cantContinue = false;
      for (let i = 0; i < input[objectKey].length; i++) {
        if (!utils.isJsonObject(input[objectKey][i])) continue;
        const tmpObjKeys: string[] = Object.keys(input[objectKey][i]);
        cantContinue = utils.findCommonElement(dictionaryKeys, tmpObjKeys);
        if (cantContinue) return result;
      }

      for (let i = 0; i < input[objectKey].length; i++) {
        if (!utils.isJsonObject(input[objectKey][i])) continue;
        let tmpObj = JSON.parse(JSON.stringify(input[objectKey][i]));
        const tmpObjKeys: string[] = Object.keys(input[objectKey][i]);

        for (let k = 0; k < tmpObjKeys.length; k++) {
          const oldKey: any = tmpObjKeys[k];
          const keyId = Compression.getCompressedKeyId(
            oldKey,
            resultOrParamsKeyMap
          );
          if (keyId) {
            tmpObj[keyId] = input[objectKey][i][oldKey];
            delete tmpObj[oldKey];
            result.compressed = true;
          }
        }
        result.json[objectKey][i] = JSON.parse(JSON.stringify(tmpObj));
      }
    } else if (isObject) {
      //check if new keys do not create conflicts with old keys
      const tmpObjKeys: string[] = Object.keys(input[objectKey]);
      const cantContinue = utils.findCommonElement(dictionaryKeys, tmpObjKeys);
      if (cantContinue) return result;

      let tmpObj = JSON.parse(JSON.stringify(input[objectKey]));

      for (let k = 0; k < tmpObjKeys.length; k++) {
        const oldKey: any = tmpObjKeys[k];
        const keyId = Compression.getCompressedKeyId(
          oldKey,
          resultOrParamsKeyMap
        );
        if (keyId) {
          tmpObj[keyId] = input[objectKey][oldKey];
          delete tmpObj[oldKey];
          result.compressed = true;
        }
      }

      result.json[objectKey] = JSON.parse(JSON.stringify(tmpObj));
    }

    return result;
  }

  private static decompressRPCSomeObjectKeys(
    input: JSONObject,
    objectKey: string
  ): JSONObject {
    let result: JSONObject = JSON.parse(JSON.stringify(input));
    const isObject = utils.isJsonObject(input[objectKey]);
    const isArrayWithAtLeastOneJsonObject =
      utils.isArrayWithAtLeastOneJsonObject(input[objectKey]);
    if (isArrayWithAtLeastOneJsonObject) {
      for (let i = 0; i < input[objectKey].length; i++) {
        if (!utils.isJsonObject(input[objectKey][i])) continue;
        let tmpObj = JSON.parse(JSON.stringify(input[objectKey][i]));
        const tmpObjKeys: string[] = Object.keys(input[objectKey][i]);

        for (let k = 0; k < tmpObjKeys.length; k++) {
          const oldKey: any = tmpObjKeys[k];
          const newKey = Compression.getDecompressedKeyId(
            oldKey,
            resultOrParamsKeyMap
          );
          if (newKey) {
            tmpObj[newKey] = input[objectKey][i][oldKey];
            delete tmpObj[oldKey];
          }
        }
        result[objectKey][i] = tmpObj;
      }
    } else if (isObject) {
      const tmpObjKeys: string[] = Object.keys(input[objectKey]);

      for (let k = 0; k < tmpObjKeys.length; k++) {
        const oldKey: any = tmpObjKeys[k];
        const newKey = Compression.getDecompressedKeyId(
          oldKey,
          resultOrParamsKeyMap
        );
        if (newKey) {
          result[objectKey][newKey] = input[objectKey][oldKey];
          delete result[objectKey][oldKey];
        }
      }
    }

    return result;
  }

  private static compressRPCMainObjectKeys(input: JSONObject): JSONObject {
    let result: JSONObject = {
      compressed: false,
      json: JSON.parse(JSON.stringify(input)),
    };

    //check if new keys do not create conflicts with old keys
    const tmpObjKeys: string[] = Object.keys(input);
    const dictionaryKeys: string[] = Object.keys(mainKeyMap);
    const cantContinue = utils.findCommonElement(dictionaryKeys, tmpObjKeys);
    if (cantContinue) return result;

    for (let k = 0; k < tmpObjKeys.length; k++) {
      const oldKey: any = tmpObjKeys[k];
      const keyId = Compression.getCompressedKeyId(oldKey, mainKeyMap);
      if (keyId) {
        result.json[keyId] = input[oldKey];
        delete result.json[oldKey];
        result.compressed = true;
      }
    }

    return result;
  }

  private static decompressRPCMainObjectKeys(input: JSONObject): JSONObject {
    let result: JSONObject = JSON.parse(JSON.stringify(input));
    const tmpObjKeys: string[] = Object.keys(input);
    for (let k = 0; k < tmpObjKeys.length; k++) {
      const oldKey: any = tmpObjKeys[k];
      const newKey = Compression.getDecompressedKeyId(oldKey, mainKeyMap);
      if (newKey) {
        result[newKey] = input[oldKey];
        delete result[oldKey];
      }
    }
    return result;
  }

  private static compressionDiagramUpdate = (
    string: string,
    index: number,
    replacement: Boolean
  ): CompressedPayload => {
    // @ts-ignore-start
    return string.substring(0, index) + replacement
      ? "1"
      : "0" + string.substring(index + 1);
    // @ts-ignore-end
  };
}

//For Testing
// main ();
// function main () {
//   const resultCompressed = Compression.compressRpcRequestSync(res_80kb);
//   const result = Compression.decompressRpcRequestSync(resultCompressed);
//   return;
// }
