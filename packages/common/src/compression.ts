import {
  JSONObject,
  CompressedPayload,
  Dictionary,
} from "./types";

import {
  mainKeyMap,
  resultOrParamsKeyMap,
  methodValueMap,
} from "./compression-dictionaries";

import * as utils from './utils'
import { unpack, pack } from 'msgpackr';
import JSZip from 'jszip';

import {
  res_normal,
  res_compress_key_problem0,
  res_compress_key_problem1,
  req_small_different_params,
  res_error,
  req_80kb,
  res_80kb
} from './compression.spec'

/**
 * Functions used to compress and decompress RPC requests 
 * The zeros in the 1st 5 places of the result mean:
 * 0 no.0 - the content is zipped
 * 0 no.1 - the content is msgpackr packed 
 * 0 no.2 - main keys compressed
 * 0 no.3 - 'params'{} keys compressed
 * 0 no.4 - 'result'{} keys compressed
 * 0 no.5 - 'method' value compressed
 * 0 no.6 - 'error'{} kets compressed
 */

export default class Compression {

  public static async compressRpcRequest(requestBody: JSONObject): Promise<CompressedPayload> {
    let compressionDiagram : CompressedPayload = '000000';
    let jsonTmp : JSONObject = JSON.parse(JSON.stringify(requestBody));
    console.log('--Checks of sizes for comparation: --');
    console.log('input size:', JSON.stringify(requestBody).length);
    console.log("only msgpackr size:", pack(jsonTmp).length);

    let testZip = new JSZip();
    testZip.file("msg", JSON.stringify(requestBody));
    let testZipStr = await testZip.generateAsync({
      type: "string",
      compression: "DEFLATE",
      compressionOptions: {
        level: 9
      }
    })
    console.log("only zip size:", testZipStr.length);

    testZip.file("msg", pack(jsonTmp));
    testZipStr = await testZip.generateAsync({
      type: "string",
      compression: "DEFLATE",
      compressionOptions: {
        level: 9
      }
    })
    console.log("msgpackr and zip size:", testZipStr.length);


    console.log('\n\n--Sizes of input after each consecutive type of compression: --');
    //Compress 'method' Value
    let result = Compression.compressRPCMethodValue(jsonTmp);
    if (result.compressed) {
      // @ts-ignore-start
      compressionDiagram = utils.replaceInStringAt(compressionDiagram, 5, '1');
      // @ts-ignore-end
      jsonTmp = result.json;
    }
    console.log("Compress 'method' Value size:", JSON.stringify(jsonTmp).length);

    //Compress 'result'{} keys
    result = Compression.compressRPCSomeObjectKeys(jsonTmp, 'result');
    if (result.compressed) {
      // @ts-ignore-start
      compressionDiagram = utils.replaceInStringAt(compressionDiagram, 4, '1');
      // @ts-ignore-end
      jsonTmp = result.json;
    }
    console.log("Compress 'result'{} keys size:", JSON.stringify(jsonTmp).length);

    //Compress 'params'{} keys
    result = Compression.compressRPCSomeObjectKeys(jsonTmp, 'params');
    if (result.compressed) {
      // @ts-ignore-start
      compressionDiagram = utils.replaceInStringAt(compressionDiagram, 3, '1');
      // @ts-ignore-end
      jsonTmp = result.json;
    }
    console.log("Compress 'params'{} keys size:", JSON.stringify(jsonTmp).length);

    //Compress 'error'{} keys
    result = Compression.compressRPCSomeObjectKeys(jsonTmp, 'error');
    if (result.compressed) {
      // @ts-ignore-start
      compressionDiagram = utils.replaceInStringAt(compressionDiagram, 6, '1');
      // @ts-ignore-end
      jsonTmp = result.json;
    }
    console.log("Compress 'error'{} keys size:", JSON.stringify(jsonTmp).length);

    //Compress main keys
    result = Compression.compressRPCMainObjectKeys(jsonTmp);
    if (result.compressed) {
      // @ts-ignore-start
      compressionDiagram = utils.replaceInStringAt(compressionDiagram, 2, '1');
      // @ts-ignore-end
      jsonTmp = result.json;
    }
    console.log("Compress 'main'{} keys size:", JSON.stringify(jsonTmp).length);

    //Compress msgpackr
    jsonTmp = pack(jsonTmp);
    jsonTmp = jsonTmp.toString('binary'); //  'ucs2', 'base64' and 'binary' also work https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
    // @ts-ignore-start
    compressionDiagram = utils.replaceInStringAt(compressionDiagram, 1, '1');
    // @ts-ignore-end
    console.log("Compress msgpackr size:", jsonTmp.length);


    let zip = new JSZip();
    zip.file("msg", jsonTmp);

    const zipped = await zip.generateAsync({
      type: "string",
      compression: "DEFLATE",
      compressionOptions: {
        level: 9
      }
    })
    console.log("Compress jszip size:", zipped.length);

    if (zipped.length < jsonTmp.length) {
      jsonTmp = zipped;
      // @ts-ignore-start
      compressionDiagram = utils.replaceInStringAt(compressionDiagram, 0, '1');
      // @ts-ignore-end
    }


    //const jsonFromBuffer = unpack(stringToBuffer);
   // Buffer.from("SGVsbG8gV29ybGQ=", 'base64'
   // console.log(jsonFromBuffer);
    // const backFromStringZip = await zip.loadAsync(Zstring9)

    // @ts-ignore-start
    return compressionDiagram + jsonTmp;
    // @ts-ignore-end
  }


  private static getCompressedKeyId(key: string, dictionary: Dictionary): string | null | PropertyKey {
    let id = null;
    const dictionaryKeys : string[] = Object.keys(dictionary);

    for(let i = 0; i < dictionaryKeys.length; i++) {
      if(key === dictionary[dictionaryKeys[i]]) {
        id = dictionaryKeys[i];
        break;
      }
    }

    return id;
  }

  private static compressRPCMethodValue(input: JSONObject): JSONObject {
    let result : JSONObject = {
      compressed: false,
      json: JSON.parse(JSON.stringify(input))
    };

    if(input['method']) {
      const method : string = input['method'];
      const methodId = Compression.getCompressedKeyId(method, methodValueMap);
      result.json['method'] = methodId;
      result.compressed = true;
    }

    return result;
  }

  private static compressRPCSomeObjectKeys(input: JSONObject, objectKey: string): JSONObject {
    let result : JSONObject = {
      compressed: false,
      json: JSON.parse(JSON.stringify(input))
    };

    if(!input[objectKey]) return result;

    const isArray = utils.isArray(input[objectKey]);
    const isObject = utils.isJsonObject(input[objectKey]);
    if(!isArray && !isObject) return result;

    const dictionaryKeys : string[] = Object.keys(resultOrParamsKeyMap);
    const isArrayWithAtLeastOneJsonObject = utils.isArrayWithAtLeastOneJsonObject(input[objectKey]);
    if(isArrayWithAtLeastOneJsonObject) {
      //check if new keys do not create conflicts with old keys
      let cantContinue = false;
      for (let i = 0; i < input[objectKey].length; i++) {
        if(!utils.isJsonObject(input[objectKey][i])) continue;
        const tmpObjKeys: string[] = Object.keys(input[objectKey][i]);
        cantContinue = utils.findCommonElement(dictionaryKeys, tmpObjKeys);
        if (cantContinue) return result;
      }

      for (let i = 0; i < input[objectKey].length; i++) {
        if(!utils.isJsonObject(input[objectKey][i])) continue;
        let tmpObj = JSON.parse(JSON.stringify(input[objectKey][i]));
        const tmpObjKeys: string[] = Object.keys(input[objectKey][i]);

        for (let k = 0; k < tmpObjKeys.length; k++) {
          const oldKey : any = tmpObjKeys[k];
          const keyId = Compression.getCompressedKeyId(oldKey, resultOrParamsKeyMap);
          if (keyId) {
            tmpObj[keyId] = input[objectKey][i][oldKey];
            delete tmpObj[oldKey];
            result.compressed = true;
          }
        }
        result.json[objectKey][i] = JSON.parse(JSON.stringify(tmpObj));
      }
    } else if(isObject) {
      //check if new keys do not create conflicts with old keys
      const tmpObjKeys: string[] = Object.keys(input[objectKey]);
      const cantContinue = utils.findCommonElement(dictionaryKeys, tmpObjKeys);
      if (cantContinue) return result;

      let tmpObj = JSON.parse(JSON.stringify(input[objectKey]));

      for (let k = 0; k < tmpObjKeys.length; k++) {
        const oldKey : any = tmpObjKeys[k];
        const keyId = Compression.getCompressedKeyId(oldKey, resultOrParamsKeyMap);
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

  private static compressRPCMainObjectKeys(input: JSONObject): JSONObject {
    let result : JSONObject = {
      compressed: false,
      json: JSON.parse(JSON.stringify(input))
    };

    //check if new keys do not create conflicts with old keys
    const tmpObjKeys: string[] = Object.keys(input);
    const dictionaryKeys : string[] = Object.keys(mainKeyMap);
    const cantContinue = utils.findCommonElement(dictionaryKeys, tmpObjKeys);
    if (cantContinue) return result;

    for (let k = 0; k < tmpObjKeys.length; k++) {
      const oldKey : any = tmpObjKeys[k];
      const keyId = Compression.getCompressedKeyId(oldKey, mainKeyMap);
      if (keyId) {
        result.json[keyId] = input[oldKey];
        delete result.json[oldKey];
        result.compressed = true;
      }
    }

    return result;
  }

}


//Compression.compressRpcRequest(a0);
const result = Compression.compressRpcRequest(res_normal);