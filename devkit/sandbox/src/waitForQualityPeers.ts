import dotenv from 'dotenv';
import path from 'path';
import nodes from './nodes'
import { api as hoprAPI } from '@hoprnet/hopr-sdk';

dotenv.config({ path: path.resolve(__dirname, '../src/.env') });

main();
async function main() {
    await waitForQualityPeers();
    return;
}

async function waitForQualityPeers(){
    let success = false;
    let error;
    for(let tryNo = 0; tryNo < 5 * 60; tryNo++) { // try for 10 min
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
            let qualityNumbers = [];
            for(let nodeNo = 0; nodeNo < nodes.length; nodeNo++) {
                const peers = await hoprAPI.getPeers({apiEndpoint: nodes[nodeNo], apiToken: process.env.HOPRD_API_TOKEN as string});
                if(peers.connected.length === nodes.length - 1) {
                    for(let peerNo = 0; peerNo < peers.connected.length; peerNo++) {
                        qualityNumbers.push(peers.connected[peerNo].quality);
                    }
                }
            }
            if(qualityNumbers.filter(quality => quality !== 1).length === 0){
                success = true;
                console.log('All nodes have quality peers.');
                break;
            }
        } catch (e){
            error = e;
        }

    }
    if(!success) {
        console.error(error);
        throw('Could not find quality peers. Exiting.');
    }
    return;
}
