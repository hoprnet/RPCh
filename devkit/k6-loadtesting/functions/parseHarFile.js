export default function parseHarReq(har) {
    let requests = [];
    har = har.log.entries;
    let waitTillNextCall;
    for (let i = 0; i < har.length; i++ ) {
        const harReq = har[i].request;
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