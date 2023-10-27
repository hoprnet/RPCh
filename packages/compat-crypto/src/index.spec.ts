import assert from 'assert';
import { isError, boxRequest, boxResponse, Session, unboxRequest, unboxResponse } from './index';
import { randomBytes } from 'crypto';

const EXIT_NODE_PK = '03d73c98d44618b7504bab1001adaa0a0c77adfb04db4b7732b1daba5e6523e7bf';
const EXIT_NODE_SK = '06ef2a621eb9df81f7d6a8f7a2499b9e670613f757648dc3258640767ebd7e0a';
const EXIT_NODE = '16Uiu2HAmUsJwbECMroQUC29LQZZWsYpYZx1oaM1H9DBoZHLkYn12';
const ENTRY_NODE = '16Uiu2HAm35DuQk2Cvp9aLpRTD43ZubLqtbAwf242w2YmAe8FskLs';

const TEST_VECTOR_EPHEMERAL_PRIVATE_KEY =
    '492057cf93e99b31d2a85bc5e98a9c3aa0021feec52c227cc8170e8f7d047775';
const TEST_VECTOR_EPHEMERAL_SECRET =
    'a27198fe268cd0af95a8c39788d44fc26638971e77ded9ee965b37e5d5d4a553';

const TEST_VECTOR_REQUEST_INPUT =
    'e1afa1e0a0a3e482bce0be80e39ca4e5a0a4e681b3d1a0e19ca8c390d7bbe380b9e69aa0e7a982ceb8cf92e4bebce7b0a5e589abe184b4c7b0e28ca0e38786e69f92e2a7a8c288e287b8c3b9e68587e19ba0e0a580e4baa439e4a8b44363d0a5e6968ac9a0e28580d297e294a8e4ad83e3ada0e2b6b2e399ace2a192e1a58ee380a7e6a58ee0aaaee680bae680aee280b5e69a89e29596e5a0bae495ace6beaee480a6e6a0a2e794a476e7b188e3a4bbe1b6b6e280a4e69a8050e480a1e3bab9e280a020';
const TEST_VECTOR_REQUEST_OUTPUT =
    '120239d1bc2291826eaed86567d225cf243ebc637275e0a5aedb0d6b1dc82136a38e000001856a69d98192302d2c0a27a012e61e086fcac4977d61805617aace48a42cc6d37d4cf7276a39c0cc81de4da122d1ead7c0ae047ae727ca788c17137455caf712265e84edeca71e5cf80119d30e09e55a9d4546178cbc254004ffa780166f154516939033e8476bf6aa332706f604289c3e22fb5a9f93dc312b9d0981c44cc48344e4f8db3e6b2a9b3d0365d5b4a96e51eae57709db62f72ce4768e88f054f8634655e6938d05e02179e308b579f352ef039e5e3f56925c03f05058b305f6f792a7e6a31ac3faace94fa667ea5254bc6937d6c7f2cc3cb4f134';
const TEST_VECTOR_RESPONSE_INPUT =
    'e1afa1e0a0b3e485ace0b480dcb0e19d88cb92e48496c7b9e48ca3e0b0b2c2b8c7b0c2812dd0a1e198a0e4b490da8ae59693e68da0e197a0e0b6a0e19d9de490a1e780b1e4b5b8e48193e1bca0e18790e4a0a0e5bd89e280a020';
const TEST_VECTOR_RESPONSE_OUTPUT =
    '000001856a69d9816d0a1e6ed9cfe3b95125d3ae02400ea86d869fce21b7e6241d22dbe911182c51345c8eb13ebc9c5cf9989e7e0f9cac2cd2a3026cc06d6fca6f2df1b45ee17f94543194b0f7f285cf261348b729fd78d6bb9a2021ca947b49f3ccbc36d43eea6efef2c4e25c205bb1286d';
const TEST_COUNTER = BigInt(1672527600000);

function fromHex(str: string) {
    return Uint8Array.from(Buffer.from(str, 'hex'));
}

function toHex(bytes: Uint8Array | undefined) {
    if (!bytes) return '';
    return Buffer.from(bytes).toString('hex');
}

describe('RPCh Crypto protocol tests', function () {
    it('test request flow', async function () {
        // Client side
        const request_msg = new Uint8Array(randomBytes(300));

        const request_data = {
            message: request_msg,
            exitPeerId: EXIT_NODE,
            exitPublicKey: fromHex(EXIT_NODE_PK),
        };

        const req_box_result = boxRequest(request_data);
        assert(
            !isError(req_box_result),
            `request boxing must not fail, error: ${
                isError(req_box_result) && req_box_result.error
            }`
        );

        const client_request_session = req_box_result.session;
        assert(client_request_session != undefined, 'must contain a valid session');
        assert(client_request_session.request != undefined, 'session must contain request data');

        // Client side end

        const client_req_creation_ts = client_request_session.updatedTS;
        const data_on_wire = client_request_session.request;

        // Exit node side

        const received_req_data = {
            message: data_on_wire,
            exitPeerId: EXIT_NODE,
            exitPrivateKey: fromHex(EXIT_NODE_SK),
        };

        const stored_last_received_req_ts = BigInt(Date.now() - 2000); // 2s ago

        const req_unbox_result = unboxRequest(received_req_data, stored_last_received_req_ts);
        assert(
            !isError(req_unbox_result),
            `request unboxing must not fail, error: ${
                isError(req_unbox_result) && req_unbox_result.error
            }`
        );

        const exit_request_session = req_unbox_result.session;
        assert(exit_request_session != undefined, 'must contain a valid session');

        assert.equal(toHex(exit_request_session.request), toHex(request_msg));
        assert.equal(exit_request_session.updatedTS, client_req_creation_ts);
    });

    it('test response flow', async function () {
        // Exit node side
        const response_msg = new Uint8Array(randomBytes(300));

        const mock_session_with_client: Session = {
            updatedTS: BigInt(1),
            sharedPreSecret: fromHex(TEST_VECTOR_EPHEMERAL_SECRET),
        };

        const response_data = {
            message: response_msg,
            entryPeerId: ENTRY_NODE,
        };

        const resp_box_result = boxResponse(mock_session_with_client, response_data);
        assert(
            !isError(resp_box_result),
            `response boxing must not fail, error: ${
                isError(resp_box_result) && resp_box_result.error
            }`
        );
        assert(mock_session_with_client.response != undefined);

        // Exit node side end

        const exit_node_resp_creation_ts = mock_session_with_client.updatedTS;
        const data_on_wire = mock_session_with_client.response;

        // Client node side

        const received_resp_data = {
            message: data_on_wire,
            entryPeerId: ENTRY_NODE,
        };

        const mock_session_with_exit_node: Session = {
            updatedTS: BigInt(1),
            sharedPreSecret: fromHex(TEST_VECTOR_EPHEMERAL_SECRET),
        };

        const stored_last_received_resp_ts = BigInt(Date.now() - 2000); // 2s ago

        const resp_unbox_result = unboxResponse(
            mock_session_with_exit_node,
            received_resp_data,
            stored_last_received_resp_ts
        );
        assert(
            !isError(resp_unbox_result),
            `response unboxing must not fail, error: ${
                isError(resp_unbox_result) && resp_unbox_result.error
            }`
        );

        assert(mock_session_with_exit_node.response != undefined);
        assert.equal(toHex(mock_session_with_exit_node.response), toHex(response_msg));
        assert.equal(mock_session_with_exit_node.updatedTS, exit_node_resp_creation_ts);
    });

    it('test complete flow', async function () {
        // Client side
        const request_msg = new Uint8Array(randomBytes(300));

        const request_data = {
            message: request_msg,
            exitPeerId: EXIT_NODE,
            exitPublicKey: fromHex(EXIT_NODE_PK),
        };

        const req_box_result = boxRequest(request_data);
        assert(
            !isError(req_box_result),
            `request boxing must not fail, error: ${
                isError(req_box_result) && req_box_result.error
            }`
        );

        const client_session = req_box_result.session;
        assert(client_session != undefined, 'must contain a valid session');
        assert(client_session.request != undefined, 'session must contain request data');

        // Client side end

        const client_req_creation_ts = client_session.updatedTS;
        const request_data_on_wire = client_session.request;

        // Exit node side

        const received_req_data = {
            message: request_data_on_wire,
            exitPeerId: EXIT_NODE,
            exitPrivateKey: fromHex(EXIT_NODE_SK),
        };

        const stored_last_received_req_ts = BigInt(Date.now() - 2000); // 2s ago

        const req_unbox_result = unboxRequest(received_req_data, stored_last_received_req_ts);
        assert(
            !isError(req_unbox_result),
            `request unboxing must not fail, error: ${
                isError(req_unbox_result) && req_unbox_result.error
            }`
        );

        const exit_session = req_unbox_result.session;
        assert(exit_session != undefined, 'must contain a valid session');

        assert.equal(toHex(exit_session.request), toHex(request_msg));
        assert.equal(exit_session.updatedTS, client_req_creation_ts);

        // Exit node side
        const response_msg = new Uint8Array(randomBytes(300));

        const response_data = {
            message: response_msg,
            entryPeerId: ENTRY_NODE,
        };

        const resp_box_result = boxResponse(exit_session, response_data);
        assert(
            !isError(resp_box_result),
            `response boxing must not fail, error: ${
                isError(resp_box_result) && resp_box_result.error
            }`
        );
        assert(exit_session.response != undefined);

        // Exit node side end

        const exit_node_resp_creation_ts = exit_session.updatedTS;
        const response_data_on_wire = exit_session.response;

        // Client node side

        const received_resp_data = {
            message: response_data_on_wire,
            entryPeerId: ENTRY_NODE,
        };

        const stored_last_received_resp_ts = BigInt(Date.now() - 2000); // 2s ago

        const resp_unbox_result = unboxResponse(
            client_session,
            received_resp_data,
            stored_last_received_resp_ts
        );
        assert(
            !isError(resp_unbox_result),
            `response unboxing must not fail, error: ${
                isError(resp_unbox_result) && resp_unbox_result.error
            }`
        );

        assert(client_session.response != undefined);
        assert.equal(toHex(client_session.response), toHex(response_msg));
        assert.equal(client_session.updatedTS, exit_node_resp_creation_ts);
    });

    it('test vectors on fixed request input', async function () {
        jest.useFakeTimers();
        jest.setSystemTime(Number(TEST_COUNTER));

        // Client side

        const request_data = {
            message: fromHex(TEST_VECTOR_REQUEST_INPUT),
            exitPeerId: EXIT_NODE,
            exitPublicKey: fromHex(EXIT_NODE_PK),
        };

        const req_box_result = boxRequest(request_data, (_) =>
            fromHex(TEST_VECTOR_EPHEMERAL_PRIVATE_KEY)
        );
        assert(
            !isError(req_box_result),
            `request boxing must not fail, error: ${
                isError(req_box_result) && req_box_result.error
            }`
        );

        const client_request_session = req_box_result.session;
        assert(client_request_session != undefined, 'must contain a valid session');

        assert(client_request_session.request != undefined, 'session must contain request data');
        assert.equal(
            toHex(client_request_session.request),
            TEST_VECTOR_REQUEST_OUTPUT,
            'session data must be equal to test vector'
        );
        assert.equal(
            client_request_session.updatedTS,
            Number(TEST_COUNTER) + 1,
            'TS must be increased'
        );

        // Client side end

        const data_on_wire = client_request_session.request;

        // Exit node side

        jest.setSystemTime(Number(TEST_COUNTER) + 10);

        const received_req_data = {
            message: data_on_wire,
            exitPeerId: EXIT_NODE,
            exitPrivateKey: fromHex(EXIT_NODE_SK),
        };

        const req_unbox_result = unboxRequest(received_req_data, BigInt(TEST_COUNTER));
        assert(
            !isError(req_unbox_result),
            `request unboxing must not fail, error: ${
                isError(req_unbox_result) && req_unbox_result.error
            }`
        );

        const exit_request_session = req_unbox_result.session;
        assert(exit_request_session != undefined, 'must contain a valid session');

        assert.equal(toHex(exit_request_session.request), TEST_VECTOR_REQUEST_INPUT);
        assert.equal(exit_request_session.updatedTS, Number(TEST_COUNTER) + 1);
    });

    it('test vectors on fixed response input', async function () {
        jest.useFakeTimers();
        jest.setSystemTime(Number(TEST_COUNTER));

        // Exit node side

        const mock_session_with_client: Session = {
            updatedTS: BigInt(1),
            sharedPreSecret: fromHex(TEST_VECTOR_EPHEMERAL_SECRET),
        };

        const response_data = {
            message: fromHex(TEST_VECTOR_RESPONSE_INPUT),
            entryPeerId: ENTRY_NODE,
        };

        const resp_box_result = boxResponse(mock_session_with_client, response_data);
        assert(
            !isError(resp_box_result),
            `response boxing must not fail, error: ${
                isError(resp_box_result) && resp_box_result.error
            }`
        );

        assert(mock_session_with_client.response != undefined);
        assert.equal(toHex(mock_session_with_client.response), TEST_VECTOR_RESPONSE_OUTPUT);
        assert.equal(mock_session_with_client.updatedTS, Number(TEST_COUNTER) + 1);

        // Exit node side end

        const data_on_wire = mock_session_with_client.response;

        // Client node side

        jest.setSystemTime(Number(TEST_COUNTER) + 10);

        const received_resp_data = {
            message: data_on_wire,
            entryPeerId: ENTRY_NODE,
        };

        const mock_session_with_exit_node: Session = {
            updatedTS: BigInt(1),
            sharedPreSecret: fromHex(TEST_VECTOR_EPHEMERAL_SECRET),
        };

        const resp_unbox_result = unboxResponse(
            mock_session_with_exit_node,
            received_resp_data,
            TEST_COUNTER
        );
        assert(
            !isError(resp_unbox_result),
            `response unboxing must not fail, error: ${
                isError(resp_unbox_result) && resp_unbox_result.error
            }`
        );

        assert(mock_session_with_exit_node.response != undefined);
        assert.equal(toHex(mock_session_with_exit_node.response), TEST_VECTOR_RESPONSE_INPUT);
        assert.equal(mock_session_with_exit_node.updatedTS, Number(TEST_COUNTER) + 1);
    });
});
