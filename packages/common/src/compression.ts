import {
  JSONObject,
  CompressedPayload,
  Dictionary,
} from "./types";

import {
  mainKeyMap,
  errorKeyMap,
  resultOrParamsKeyMap,
  methodValueMap,
} from "./compression-dictionaries";

import * as utils from './utils'


/**
 * Functions used to compress and decompress RPC requests 
 * The zeros in the 1st 5 places of the result mean:
 * 0 no.0 - the content is zipped
 * 0 no.1 - 
 * 0 no.2 - 'params'{} keys compressed
 * 0 no.3 - 'result'{} keys compressed
 * 0 no.4 - 'method' value compressed
 */

const a0 = {
  "jsonrpc": "2.0",
  "id": 1,
  "result": [
      {
          "address": "0x1a9469a12afbc91ca1",
          "blockHash": "0x7c5a35e9cb3ffcab52c70",
          "blockNumber": "09fb",
          "data": "0x000000002a23",
          "logIndex": "0x1d",
          "removed": false,
          "topics": [
              "0x241ea0350f73818b80"
          ],
          "transactionHash": "0x3dc91b98fb3063d9c04d50",
          "transactionIndex": "0x1d"
      },
      {
          "address": "0x06012c87f8e7a266d",
          "blockHash": "0x7c5a35e9cb3e8ae0edcffcab52c70",
          "blockNumber": "0x5c29fb",
          "data": "0x00008e374400000000000000000000000000000000a0f",
          "logIndex": "0x57",
          "removed": false,
          "topics": [
              "0x241ea03ca8b80"
          ],
          "transactionHash": "0x788b14b34e92beec1",
          "transactionIndex": "0x54"
      }
  ]
};

const a1 = {
  "jsonrpc": "2.0",
  "result": {
      "author": "0x0000000000000000000",
      "difficulty": "0x0",
      "extraData": "0x4e6696e64",
      "5": "0x103a718",
      "gasUsed": "0xe03a3",
      "hash": "0x9a26373f41e528a5f635467c592ea353e09680f3c9b2f521aaa5e349bca948aa",
      "logsBloom": "0x00000000000000000000000000000000000000000000008400000000000000002000080000000000200120000000000000000000000008000000000000000000080000000000000004000000000000000000000000000000000000000000000000008000000010000000000040000000000000000000000000000200000000000000100000004000000000020000080000004000000000000000000000000000000000000000000000000000081002000000000000000000000000000000000000200000000000000040000010002000000000000000000008000000000000040000000000000000000402",
      "miner": "0x0000000000000000000000000",
      "mixHash": "0x2e803d00e46c7c4f235bfdf882",
      "nonce": "0x0000000000000000",
      "55": "0x1a2801d",
      "parentHash": "0xa2f774501c0bc3ee",
      "receiptsRoot": "0xca4b47252fcb9e",
      "sha3Uncles": "0x1dcc4de0d49347",
      "size": "0x7db",
      "stateRoot": "0x251fdd08acd0c4fb5dec3f5273db2589c9b8",
      "totalDifficulty": "0x2",
      "timestamp": "0x6437f1c2",
      "baseFeePerGas": "0x7",
      "transactions": [
          "0xf81b4659bcde2e005501473b994",
          "0x5f0d6a7afc5f273eb0d",
          "0x1b115daa7f38c2"
      ],
      "transactionsRoot": "0x52aeed76a9060fed",
      "uncles": []
  },
  "id": 73312
};

const a2 = {
  "jsonrpc": "2.0",
  "result": {
      "author": "0x0000000000000000000",
      "difficulty": "0x0",
      "extraData": "0x4e6696e64",
      "5": "0x103a718",
      "gasUsed": "0xe03a3",
      "hash": "0x9a26373f41e528a5f635467c592ea353e09680f3c9b2f521aaa5e349bca948aa",
      "logsBloom": "0x00000000000000000000000000000000000000000000008400000000000000002000080000000000200120000000000000000000000008000000000000000000080000000000000004000000000000000000000000000000000000000000000000008000000010000000000040000000000000000000000000000200000000000000100000004000000000020000080000004000000000000000000000000000000000000000000000000000081002000000000000000000000000000000000000200000000000000040000010002000000000000000000008000000000000040000000000000000000402",
      "miner": "0x0000000000000000000000000",
      "mixHash": "0x2e803d00e46c7c4f235bfdf882",
      "nonce": "0x0000000000000000",
      "number": "0x1a2801d",
      "parentHash": "0xa2f774501c0bc3ee",
      "receiptsRoot": "0xca4b47252fcb9e",
      "sha3Uncles": "0x1dcc4de0d49347",
      "size": "0x7db",
      "stateRoot": "0x251fdd08acd0c4fb5dec3f5273db2589c9b8",
      "totalDifficulty": "0x2",
      "timestamp": "0x6437f1c2",
      "baseFeePerGas": "0x7",
      "transactions": [
          "0xf81b4659bcde2e005501473b994",
          "0x5f0d6a7afc5f273eb0d",
          "0x1b115daa7f38c2"
      ],
      "transactionsRoot": "0x52aeed76a9060fed",
      "uncles": []
  },
  "id": 73312
};

const a3 = {
  "id": 1378637,
  "jsonrpc": "2.0",
  "method": "eth_estimateGas",
  "params": [
      {
          "from": "0x66087fb21b1274771",
          "to": "0xa02af239a614ab47f0d",
          "value": "0x0",
          "data": "0xef5cfb8421b1274771"
      },
      "0x01a"
  ]
}

export default class Compression {

  public static compressRpcRequest(requestBody: JSONObject): CompressedPayload {
    let compressionDiagram : CompressedPayload = '00000';
    let jsonTmp : JSONObject = JSON.parse(JSON.stringify(requestBody));

    const jsonKeys : string[] = Object.keys(requestBody);

    //Compress 'method' Value
    let result = Compression.compressRPCMethodValue(jsonTmp);
    if (result.compressed) {
      // @ts-ignore-start
      compressionDiagram = utils.replaceInStringAt(compressionDiagram, 4, '1');
      // @ts-ignore-end
      jsonTmp = result.json;
    }

    //Compress 'result'{} keys
    result = Compression.compressRPCSomeObjectKeys(jsonTmp, 'result');
    if (result.compressed) {
      // @ts-ignore-start
      compressionDiagram = utils.replaceInStringAt(compressionDiagram, 3, '1');
      // @ts-ignore-end
      jsonTmp = result.json;
    }

    //Compress 'params'{} keys
    result = Compression.compressRPCSomeObjectKeys(jsonTmp, 'params');
    if (result.compressed) {
      // @ts-ignore-start
      compressionDiagram = utils.replaceInStringAt(compressionDiagram, 2, '1');
      // @ts-ignore-end
      jsonTmp = result.json;
    }
    
    return jsonTmp;
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

}


//Compression.compressRpcRequest(a0);
const result = Compression.compressRpcRequest(a0);

console.log('wait');