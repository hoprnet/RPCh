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