 /* 
  * Function that will create a loadtesting scenario 
  * for k6 loadtesting out of a HAR file which contains 
  * recorded network calls of a wallet.
  * HAR file can be generated using Network Tab from
  * Chromium based browsers.
  */

export default function parseHarFile(har) {
    let requests = [];
    har = har.log.entries;
    let waitTillNextCall;
    for (let i = 0; i < har.length; i++ ) {
        const harReq = har[i].request;

        //Check for RPC call
        if (harReq.method !== "POST" || harReq.postData.text.includes('jsonrpc')) continue;

        // Params
        let params = {
            headers: {},
        };
        harReq.headers.map( header => {
            if (header.name[0] !== ':'){
                params.headers[header.name] = header.value
            }
        })

        //Body
        let body = harReq.postData.text;

        //waitTillNextCall
        if (har[i+1]) {
            const startedDateTimeEpoch = new Date(har[i].startedDateTime);
            const startedDateTimeEpochNext = new Date(har[i+1].startedDateTime);
            waitTillNextCall = parseInt((startedDateTimeEpochNext - startedDateTimeEpoch)/1000);
        } else {
            waitTillNextCall = 0;
        }
        
        requests.push({params, body, waitTillNextCall})
    }

    return requests;
}