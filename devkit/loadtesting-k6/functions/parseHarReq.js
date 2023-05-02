 /* 
  * Function that will create a single object needed   
  * for k6 loadtesting. It does it based of a request 
  * which can be copied from a HAR file that
  * contains recorded network calls of a wallet.
  * HAR file can be generated using Network Tab from
  * Chromium based browsers.
  */

export default function parseHarReq(harReq) {
    let params = {
        headers: {},
    };
    harReq.headers.map( header => {
        if (header.name[0] !== ':'){
            params.headers[header.name] = header.value
        }
    })
    let body = harReq.postData.text;
    return {params, body};
}