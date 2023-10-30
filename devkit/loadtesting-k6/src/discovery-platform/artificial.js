import http from 'k6/http';
import { check } from 'k6';

// Test configuration
export const options = {
    thresholds: {
        // Assert that 99% of requests finish within 3000ms.
        http_req_duration: ['p(99) < 3000'],
    },
    // Ramp the number of virtual users up and down
    stages: [
        { duration: '5s', target: 1 },
        { duration: '20s', target: 10 },
        { duration: '1s', target: 1 },
        { duration: '10m', target: 10000 },
    ],
};

const URL = 'http://localhost:3020/';

// Simulated user behavior
export default function () {
    let res = http.get(URL + 'api/v1/node');
    check(res, {
        'status was 200': (r) => r.status == 200 || r.status == 304,
        'verify resp': (r) => r.body.includes('hoprd_api_token'),
    });
    let res2 = http.get(URL + 'api/v1/node?hasExitNode=true');
    check(res2, {
        'status was 200': (r) => r.status == 200 || r.status == 304,
        'verify resp': (r) => r.body.includes('hoprd_api_token'),
    });
}
