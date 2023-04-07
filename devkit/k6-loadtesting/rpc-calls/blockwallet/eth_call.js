export const eth_getCode = {
    "method": "POST",
    "url": "https://mainnet-node.blockwallet.io/",
    "httpVersion": "h3",
    "headers": [
        {
            "name": "accept",
            "value": "*/*"
        },
        {
            "name": "accept-encoding",
            "value": "gzip, deflate, br"
        },
        {
            "name": "accept-language",
            "value": "en-US,en;q=0.9"
        },
        {
            "name": "cache-control",
            "value": "max-age=0"
        },
        {
            "name": "content-length",
            "value": "201"
        },
        {
            "name": "content-type",
            "value": "application/json"
        },
        {
            "name": "cookie",
            "value": "_ga=GA1.2.104076536.1677182023; _gid=GA1.2.309979567.1677182023; _rdt_uuid=1677182023376.9ce632c8-eace-43e5-9c6b-a303c6668181; _ga_9PHCRT1ZFJ=GS1.1.1677182023.1.0.1677182023.0.0.0"
        },
        {
            "name": "origin",
            "value": "chrome-extension://bopcbmipnjdcdfflfgjdgdjejmgpoaab"
        },
        {
            "name": "sec-ch-ua",
            "value": "\"Chromium\";v=\"110\", \"Not A(Brand\";v=\"24\", \"Google Chrome\";v=\"110\""
        },
        {
            "name": "sec-ch-ua-mobile",
            "value": "?0"
        },
        {
            "name": "sec-ch-ua-platform",
            "value": "\"Windows\""
        },
        {
            "name": "sec-fetch-dest",
            "value": "empty"
        },
        {
            "name": "sec-fetch-mode",
            "value": "cors"
        },
        {
            "name": "sec-fetch-site",
            "value": "none"
        },
        {
            "name": "user-agent",
            "value": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36"
        },
        {
            "name": "wallet",
            "value": "BlockWallet"
        }
    ],
    "queryString": [],
    "cookies": [
        {
            "name": "_ga",
            "value": "GA1.2.104076536.1677182023",
            "path": "/",
            "domain": ".blockwallet.io",
            "expires": "2024-03-29T19:53:43.923Z",
            "httpOnly": false,
            "secure": false
        },
        {
            "name": "_gid",
            "value": "GA1.2.309979567.1677182023",
            "path": "/",
            "domain": ".blockwallet.io",
            "expires": "2023-02-24T19:53:43.000Z",
            "httpOnly": false,
            "secure": false
        },
        {
            "name": "_rdt_uuid",
            "value": "1677182023376.9ce632c8-eace-43e5-9c6b-a303c6668181",
            "path": "/",
            "domain": ".blockwallet.io",
            "expires": "2023-05-24T19:53:43.000Z",
            "httpOnly": false,
            "secure": true,
            "sameSite": "Strict"
        },
        {
            "name": "_ga_9PHCRT1ZFJ",
            "value": "GS1.1.1677182023.1.0.1677182023.0.0.0",
            "path": "/",
            "domain": ".blockwallet.io",
            "expires": "2024-03-29T19:53:43.931Z",
            "httpOnly": false,
            "secure": false
        }
    ],
    "headersSize": -1,
    "bodySize": 201,
    "postData": {
        "mimeType": "application/json",
        "text": "{\"method\":\"eth_call\",\"params\":[{\"to\":\"0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e\",\"data\":\"0x0178b8bf055c338dd6efeb3b4696940a72759f266b74f3e35de5fa6be05676e417f6dff4\"},\"latest\"],\"id\":52,\"jsonrpc\":\"2.0\"}"
    }
}