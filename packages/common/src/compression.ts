import {
  JSONObject,
  CompressedPayload,
  Dictionary
} from "./types";

import * as utils from './utils'

/**
 * Dictionaries used to compress and decompress RPC keys and methods 
 * more info: https://ethereum.org/en/developers/docs/apis/json-rpc/
 */

const mainKeyMap : Dictionary = {
  0: 'id',
  1: 'params',
  2: 'method',
  3: 'result',
  4: 'error',
  5: '__jsonclass__',
  6: 'version',
  7: 'kwparams',
  8: 'jsonrpc',
}

const errorKeyMap : Dictionary = {
  0: 'code',
  1: 'name',
  2: 'message',
  3: 'error',
  4: 'at',
  5: 'text',
  6: 'data',
}

const resultOrParamsKeyMap : Dictionary= {
  0: 'hash',
  1: 'from',
  2: 'to',
  3: 'expiry',
  4: 'sent',
  5: 'ttl',
  6: 'topics',
  7: 'payload',
  8: 'workProved',
  9: 'difficulty',
  10:'extraData',
  11:'gasLimit',
  12:'gasUsed',
  13:'hash',
  14:'logsBloom',
  15:'miner',
  16:'mixHash',
  17:'nonce',
  18:'number',
  19:'parentHash',
  20:'receiptsRoot',
  21:'sha3Uncles',
  22:'size',
  23:'stateRoot',
  24:'timestamp',
  25:'totalDifficulty',
  26:'transactions',
  27:'transactionsRoot',
  28:'uncles',
  29:'blockHash',
  30:'blockNumber',
  31:'from',
  32:'gas',
  33:'gasPrice',
  34:'hash',
  35:'input',
  36:'nonce',
  37:'to',
  38:'transactionIndex',
  39:'value',
  40:'startingBlock',
  41:'currentBlock',
  42:'highestBlock',
  43:'logIndex',
  45:'removed',
  46:'contractAddress',
  47:'cumulativeGasUsed',
  48:'effectiveGasPrice',
  49:'from',
  50:'gasUsed',
  51:'logs',
  52:'address',
  53:'status',
  54:'to',
  55:'transactionHash',
  57:'transactionIndex',
  58:'type',
  59:'code',
  60:'info',
  61:'maxPriorityFeePerGas',
  62:'maxFeePerGas',
  63:'data',
  64:'author',
  65:'difficulty',
  66:'extraData',
  67:'gasLimit',
  68:'gasUsed',
  69:'hash',
  71:'miner',
  72:'mixHash',
  73:'nonce',
  74:'number',
  75:'parentHash',
  76:'receiptsRoot',
  77:'sha3Uncles',
  78:'size',
  79:'stateRoot',
  80:'totalDifficulty',
  81:'timestamp',
  82:'baseFeePerGas',
  83:'transactions',
  84:'transactionsRoot',
  85:'uncles',
  86:'gasUsedRatio',
  87:'oldestBlock',
  88:'reward',
  89:'accountProof',
  90:'balance',
  91:'codeHash',
  92:'nonce',
  93:'storageHash',
  94:'storageProof',
}

const methodValueMap : Dictionary = {
  0:'web3_clientVersion',
  1:'web3_sha3',
  2:'net_version',
  3:'net_listening',
  4:'net_peerCount',
  5:'eth_protocolVersion',
  6:'eth_syncing',
  7:'eth_coinbase',
  8:'eth_mining',
  9:'eth_hashrate',
  10:'eth_gasPrice',
  11:'eth_accounts',
  12:'eth_blockNumber',
  13:'eth_getBalance',
  14:'eth_getStorageAt',
  15:'eth_getTransactionCount',
  16:'eth_getBlockTransactionCountByHash',
  17:'eth_getBlockTransactionCountByNumber',
  18:'eth_getUncleCountByBlockHash',
  19:'eth_getUncleCountByBlockNumber',
  20:'eth_getCode',
  21:'eth_sign',
  22:'eth_signTransaction',
  23:'eth_sendTransaction',
  24:'eth_sendRawTransaction',
  25:'eth_call',
  26:'eth_estimateGas',
  27:'eth_getBlockByHash',
  28:'eth_getBlockByNumber',
  29:'eth_getTransactionByHash',
  30:'eth_getTransactionByBlockHashAndIndex',
  31:'eth_getTransactionByBlockNumberAndIndex',
  32:'eth_getTransactionReceipt',
  33:'eth_getUncleByBlockHashAndIndex',
  34:'eth_getUncleByBlockNumberAndIndex',
  35:'eth_getCompilers',
  36:'eth_compileSolidity',
  37:'eth_compileLLL',
  38:'eth_compileSerpent',
  39:'eth_newFilter',
  40:'eth_newBlockFilter',
  41:'eth_newPendingTransactionFilter',
  42:'eth_uninstallFilter',
  43:'eth_getFilterChanges',
  44:'eth_getFilterLogs',
  45:'eth_getLogs',
  46:'eth_getWork',
  47:'eth_submitWork',
  48:'eth_submitHashrate',
  49:'db_putString',
  50:'db_getString',
  51:'db_putHex',
  52:'db_getHex',
  53:'shh_version',
  54:'shh_post',
  55:'shh_newIdentity',
  56:'shh_hasIdentity',
  57:'shh_newGroup',
  58:'shh_addToGroup',
  59:'shh_newFilter',
  60:'shh_uninstallFilter',
  61:'shh_getFilterChanges',
  62:'shh_getMessages',
}

/**
 * Functions used to compress and decompress RPC requests 
 * The zeros in the 1st 5 places of the result mean:
 * 0 no.0 - the content is zipped
 * 0 no.1 - 
 * 0 no.2 - 
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
    const isArrayOfJsonObjects = utils.isArrayOfJsonObjects(input[objectKey]);
    if(isArrayOfJsonObjects) {
      //check if new keys do not create conflicts with old keys
      let cantContinue = false;
      for (let i = 0; i < input[objectKey].length; i++) {
        const tmpObjKeys: string[] = Object.keys(input[objectKey][i]);
        cantContinue = utils.findCommonElement(dictionaryKeys, tmpObjKeys);
        if (cantContinue) return result;
      }

      for (let i = 0; i < input[objectKey].length; i++) {
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
//Compression.compressRpcRequest(a1);

console.log('wait');