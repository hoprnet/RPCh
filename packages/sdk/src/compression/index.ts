import { unpack, pack } from "msgpackr";
import LZString from "lz-string";

import {
  mainKeyMap,
  resultOrParamsKeyMap,
  methodValueMap,
} from "./dictionaries";

export type Dictionary = { [x: string]: string };

type JSONObject =
  | any
  | string
  | number
  | boolean
  | { [x: string]: JSONObject }
  | Array<JSONObject>;
type CompressedDiagram = `${"0" | "1"}${"0" | "1"}${"0" | "1"}${"0" | "1"}${
  | "0"
  | "1"}${"0" | "1"}`;
type CompressedPayload = `${CompressedDiagram}${string}`;

const MAX_BYTES = 400;

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
 * 0 no.7 - payload was a 1: JSON, 0: string
 * 0 no.8 - TBD
 * 0 no.9 - TBD
 */

export function compressRpcRequest(requestBody: JSONObject): CompressedPayload {
  let compressionDiagram: CompressedPayload = "0000000000";
  let jsonTmp: JSONObject = null;
  let payloadIsJSON = false;
  try {
    if (typeof requestBody === "string") {
      jsonTmp = JSON.parse(requestBody);
      payloadIsJSON = true;
    } else {
      jsonTmp = JSON.parse(JSON.stringify(requestBody));
      payloadIsJSON = true;
      compressionDiagram = compressionDiagramUpdate(
        compressionDiagram,
        7,
        true
      );
    }
  } catch (e) {
    jsonTmp = requestBody;
  }

  //Compress 'method' Value
  if (payloadIsJSON) {
    let result = compressRPCMethodValue(jsonTmp);
    if (result.compressed) {
      compressionDiagram = compressionDiagramUpdate(
        compressionDiagram,
        6,
        true
      );
      jsonTmp = result.json;
    }

    //Compress 'result'{} keys
    result = compressRPCSomeObjectKeys(jsonTmp, "result");
    if (result.compressed) {
      compressionDiagram = compressionDiagramUpdate(
        compressionDiagram,
        4,
        true
      );
      jsonTmp = result.json;
    }

    //Compress 'params'{} keys
    result = compressRPCSomeObjectKeys(jsonTmp, "params");
    if (result.compressed) {
      compressionDiagram = compressionDiagramUpdate(
        compressionDiagram,
        3,
        true
      );
      jsonTmp = result.json;
    }

    //Compress 'error'{} keys
    result = compressRPCSomeObjectKeys(jsonTmp, "error");
    if (result.compressed) {
      compressionDiagram = compressionDiagramUpdate(
        compressionDiagram,
        5,
        true
      );
      jsonTmp = result.json;
    }

    //Compress main keys
    result = compressRPCMainObjectKeys(jsonTmp);
    if (result.compressed) {
      compressionDiagram = compressionDiagramUpdate(
        compressionDiagram,
        2,
        true
      );
      jsonTmp = result.json;
    }

    //Compress msgpackr
    jsonTmp = pack(jsonTmp);
    jsonTmp = jsonTmp.toString("binary"); //  'ucs2', 'base64' and 'binary' also work https://stackoverflow.com/questions/6182315/how-can-i-do-base64-encoding-in-node-js
    compressionDiagram = compressionDiagramUpdate(compressionDiagram, 1, true);
  }

  if (jsonTmp.length > MAX_BYTES - 10) {
    const zipped = LZString.compressToUTF16(jsonTmp);

    if (zipped.length < jsonTmp.length) {
      jsonTmp = zipped;
      compressionDiagram = compressionDiagramUpdate(
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

export function decompressRpcRequest(compressedBody: string): JSONObject {
  // @ts-ignore-start
  let compressionDiagram: CompressedPayload = compressedBody.substring(0, 10);
  // @ts-ignore-end

  if (!/^[01]+$/.test(compressionDiagram)) {
    return compressedBody;
  }

  let jsonTmp: JSONObject = compressedBody.substring(10);

  if (compressionDiagram[0] === "1") {
    jsonTmp = LZString.decompressFromUTF16(jsonTmp);
  }

  if (compressionDiagram[1] === "1") {
    const msgpackrBuffer = Buffer.from(jsonTmp, "binary");
    try {
      jsonTmp = unpack(msgpackrBuffer);
    } catch (ex: any) {
      console.log("MSGPACK ERROR 1", compressedBody);
      console.log("MSGPACK ERROR 2", compressionDiagram);
      console.log("MSGPACK ERROR 3", jsonTmp);
      console.log("MSGPACK ERROR 4", compressedBody.substring(10));
      console.log("MSGPACK ERROR 5", ex);
    }
  }

  if (compressionDiagram[2] === "1") {
    jsonTmp = decompressRPCMainObjectKeys(jsonTmp);
  }

  if (compressionDiagram[5] === "1") {
    jsonTmp = decompressRPCSomeObjectKeys(jsonTmp, "error");
  }

  if (compressionDiagram[4] === "1") {
    jsonTmp = decompressRPCSomeObjectKeys(jsonTmp, "result");
  }

  if (compressionDiagram[3] === "1") {
    jsonTmp = decompressRPCSomeObjectKeys(jsonTmp, "params");
  }

  if (compressionDiagram[6] === "1") {
    jsonTmp = decompressRPCMethodValue(jsonTmp);
  }

  if (compressionDiagram[1] === "1" && compressionDiagram[7] === "0") {
    jsonTmp = JSON.stringify(jsonTmp);
  }

  return jsonTmp;
}

function getCompressedKeyId(
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

function getDecompressedKeyId(
  key: string,
  dictionary: Dictionary
): string | null | PropertyKey {
  return dictionary[key];
}

function compressRPCMethodValue(input: JSONObject): JSONObject {
  let result: JSONObject = {
    compressed: false,
    json: JSON.parse(JSON.stringify(input)),
  };

  if (input["method"]) {
    const method: string = input["method"];
    const methodId = getCompressedKeyId(method, methodValueMap);
    if (methodId) {
      result.json["method"] = methodId;
      result.compressed = true;
    }
  }

  return result;
}

function decompressRPCMethodValue(input: JSONObject): JSONObject {
  let result: JSONObject = JSON.parse(JSON.stringify(input));
  const methodId: string = input["method"];
  const methodName = getDecompressedKeyId(methodId, methodValueMap);
  result["method"] = methodName;
  return result;
}

//  TODO: In future we could use recurrence here
function compressRPCSomeObjectKeys(
  input: JSONObject,
  objectKey: string
): JSONObject {
  let result: JSONObject = {
    compressed: false,
    json: JSON.parse(JSON.stringify(input)),
  };

  if (!input[objectKey]) return result;

  const isArray = Array.isArray(input[objectKey]);
  const isObject = isJSONobj(input[objectKey]);
  if (!isArray && !isObject) return result;

  const dictionaryKeys: string[] = Object.keys(resultOrParamsKeyMap);
  const arrWithJSON = isArrayWithAtLeastOneJsonObject(input[objectKey]);
  if (arrWithJSON) {
    //check if new keys do not create conflicts with old keys
    let cantContinue = false;
    for (let i = 0; i < input[objectKey].length; i++) {
      if (!isJSONobj(input[objectKey][i])) continue;
      const tmpObjKeys: string[] = Object.keys(input[objectKey][i]);
      cantContinue = findCommonElement(dictionaryKeys, tmpObjKeys);
      if (cantContinue) return result;
    }

    for (let i = 0; i < input[objectKey].length; i++) {
      if (!isJSONobj(input[objectKey][i])) continue;
      let tmpObj = JSON.parse(JSON.stringify(input[objectKey][i]));
      const tmpObjKeys: string[] = Object.keys(input[objectKey][i]);

      for (let k = 0; k < tmpObjKeys.length; k++) {
        const oldKey: any = tmpObjKeys[k];
        const keyId = getCompressedKeyId(oldKey, resultOrParamsKeyMap);
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
    const cantContinue = findCommonElement(dictionaryKeys, tmpObjKeys);
    if (cantContinue) return result;

    let tmpObj = JSON.parse(JSON.stringify(input[objectKey]));

    for (let k = 0; k < tmpObjKeys.length; k++) {
      const oldKey: any = tmpObjKeys[k];
      const keyId = getCompressedKeyId(oldKey, resultOrParamsKeyMap);
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

function decompressRPCSomeObjectKeys(
  input: JSONObject,
  objectKey: string
): JSONObject {
  let result: JSONObject = JSON.parse(JSON.stringify(input));
  const isObject = isJSONobj(input[objectKey]);
  const arrWithJSON = isArrayWithAtLeastOneJsonObject(input[objectKey]);
  if (arrWithJSON) {
    for (let i = 0; i < input[objectKey].length; i++) {
      if (!isJSONobj(input[objectKey][i])) continue;
      let tmpObj = JSON.parse(JSON.stringify(input[objectKey][i]));
      const tmpObjKeys: string[] = Object.keys(input[objectKey][i]);

      for (let k = 0; k < tmpObjKeys.length; k++) {
        const oldKey: any = tmpObjKeys[k];
        const newKey = getDecompressedKeyId(oldKey, resultOrParamsKeyMap);
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
      const newKey = getDecompressedKeyId(oldKey, resultOrParamsKeyMap);
      if (newKey) {
        result[objectKey][newKey] = input[objectKey][oldKey];
        delete result[objectKey][oldKey];
      }
    }
  }

  return result;
}

function compressRPCMainObjectKeys(input: JSONObject): JSONObject {
  let result: JSONObject = {
    compressed: false,
    json: JSON.parse(JSON.stringify(input)),
  };

  //check if new keys do not create conflicts with old keys
  const tmpObjKeys: string[] = Object.keys(input);
  const dictionaryKeys: string[] = Object.keys(mainKeyMap);
  const cantContinue = findCommonElement(dictionaryKeys, tmpObjKeys);
  if (cantContinue) return result;

  for (let k = 0; k < tmpObjKeys.length; k++) {
    const oldKey: any = tmpObjKeys[k];
    const keyId = getCompressedKeyId(oldKey, mainKeyMap);
    if (keyId) {
      result.json[keyId] = input[oldKey];
      delete result.json[oldKey];
      result.compressed = true;
    }
  }

  return result;
}

function decompressRPCMainObjectKeys(input: JSONObject): JSONObject {
  let result: JSONObject = JSON.parse(JSON.stringify(input));
  const tmpObjKeys: string[] = Object.keys(input);
  for (let k = 0; k < tmpObjKeys.length; k++) {
    const oldKey: any = tmpObjKeys[k];
    const newKey = getDecompressedKeyId(oldKey, mainKeyMap);
    if (newKey) {
      result[newKey] = input[oldKey];
      delete result[oldKey];
    }
  }
  return result;
}

function compressionDiagramUpdate(
  string: string,
  index: number,
  replacement: Boolean
): CompressedPayload {
  // @ts-ignore-start
  return `${string.substring(0, index)}${
    replacement ? "1" : "0"
  }${string.substring(index + 1)}`;
  // @ts-ignore-end
}

function isJSONobj(input: any): boolean {
  return input.constructor == Object;
}

/**
 * Function to check if variable is an array and has at least one json object
 */
function isArrayWithAtLeastOneJsonObject(input: any): boolean {
  const isArrayBool = Array.isArray(input);
  if (!isArrayBool) return false;
  if (input.length === 0) return false;

  for (let i = 0; i < input.length; i++) {
    const isJsonObjectBool = isJSONobj(input[i]);
    if (isJsonObjectBool) return true;
  }

  return false;
}

/**
 * Function to check if variable is an array of json objectsobject
 */
function findCommonElement(array1: string[], array2: string[]): boolean {
  // Loop for array1
  for (let i = 0; i < array1.length; i++) {
    // Loop for array2
    for (let j = 0; j < array2.length; j++) {
      // Compare the element of each and
      // every element from both of the
      // arrays
      if (array1[i] === array2[j]) {
        // Return if common element found
        return true;
      }
    }
  }

  // Return if no common element exist
  return false;
}
