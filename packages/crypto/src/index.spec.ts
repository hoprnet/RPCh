import {box_request, box_response, Envelope, Identity, Session, unbox_request, unbox_response} from "./index";
import assert from "assert";

const EXIT_NODE_PK = '03d73c98d44618b7504bab1001adaa0a0c77adfb04db4b7732b1daba5e6523e7bf'
const EXIT_NODE_SK = '06ef2a621eb9df81f7d6a8f7a2499b9e670613f757648dc3258640767ebd7e0a'
const EXIT_NODE = '16Uiu2HAmUsJwbECMroQUC29LQZZWsYpYZx1oaM1H9DBoZHLkYn12'
const ENTRY_NODE = '16Uiu2HAm35DuQk2Cvp9aLpRTD43ZubLqtbAwf242w2YmAe8FskLs'

const TEST_VECTOR_EPHEMERAL_PRIVATE_KEY = '492057cf93e99b31d2a85bc5e98a9c3aa0021feec52c227cc8170e8f7d047775'
const TEST_VECTOR_EPHEMERAL_SECRET = 'a27198fe268cd0af95a8c39788d44fc26638971e77ded9ee965b37e5d5d4a553'

const TEST_VECTOR_REQUEST_INPUT = 'e1afa1e0a0a3e482bce0be80e39ca4e5a0a4e681b3d1a0e19ca8c390d7bbe380b9e69aa0e7a982ceb8cf92e4bebce7b0a5e589abe184b4c7b0e28ca0e38786e69f92e2a7a8c288e287b8c3b9e68587e19ba0e0a580e4baa439e4a8b44363d0a5e6968ac9a0e28580d297e294a8e4ad83e3ada0e2b6b2e399ace2a192e1a58ee380a7e6a58ee0aaaee680bae680aee280b5e69a89e29596e5a0bae495ace6beaee480a6e6a0a2e794a476e7b188e3a4bbe1b6b6e280a4e69a8050e480a1e3bab9e280a020'
const TEST_VECTOR_REQUEST_OUTPUT = '120239d1bc2291826eaed86567d225cf243ebc637275e0a5aedb0d6b1dc82136a38e000001856a69d98192302d2c0a27a012e61e086fcac4977d61805617aace48a42cc6d37d4cf7276a39c0cc81de4da122d1ead7c0ae047ae727ca788c17137455caf712265e84edeca71e5cf80119d30e09e55a9d4546178cbc254004ffa780166f154516939033e8476bf6aa332706f604289c3e22fb5a9f93dc312b9d0981c44cc48344e4f8db3e6b2a9b3d0365d5b4a96e51eae57709db62f72ce4768e88f054f8634655e6938d05e02179e308b579f352ef039e5e3f56925c03f05058b305f6f792a7e6a31ac3faace94fa667ea5254bc6937d6c7f2cc3cb4f134'
const TEST_VECTOR_RESPONSE_INPUT = 'e1afa1e0a0b3e485ace0b480dcb0e19d88cb92e48496c7b9e48ca3e0b0b2c2b8c7b0c2812dd0a1e198a0e4b490da8ae59693e68da0e197a0e0b6a0e19d9de490a1e780b1e4b5b8e48193e1bca0e18790e4a0a0e5bd89e280a020'
const TEST_VECTOR_RESPONSE_OUTPUT = '000001856a69d9816d0a1e6ed9cfe3b95125d3ae02400ea86d869fce21b7e6241d22dbe911182c51345c8eb13ebc9c5cf9989e7e0f9cac2cd2a3026cc06d6fca6f2df1b45ee17f94543194b0f7f285cf261348b729fd78d6bb9a2021ca947b49f3ccbc36d43eea6efef2c4e25c205bb1286d'
const TEST_COUNTER = 1672527600000

function fromHex(str: string) {
    return Uint8Array.from(Buffer.from(str, 'hex'))
}

function toHex(bytes: Uint8Array | undefined) {
    if (!bytes) return ''
    return Buffer.from(bytes).toString('hex')
}

describe('RPCh Crypto protocol tests', function () {
    it('test vectors on fixed request input', async function () {
        jest.useFakeTimers()
        jest.setSystemTime(new Date(TEST_COUNTER))

        // Client side

        let request_data: Envelope = {
            message: fromHex(TEST_VECTOR_REQUEST_INPUT),
            entryPeerId: ENTRY_NODE,
            exitPeerId: EXIT_NODE
        }

        let exit_id: Identity = {
            publicKey: fromHex(EXIT_NODE_PK)
        }

        let req_box_result = box_request(request_data, exit_id, (_) => fromHex(TEST_VECTOR_EPHEMERAL_PRIVATE_KEY))
        assert(!req_box_result.isErr, `request boxing must not fail, error: ${req_box_result.message}`)

        let client_request_session = req_box_result.session
        assert(client_request_session != undefined, 'must contain a valid session')

        assert(client_request_session.request != undefined, 'session must contain request data')
        assert.equal(toHex(client_request_session.request), TEST_VECTOR_REQUEST_OUTPUT, 'session data must be equal to test vector')
        assert.equal(client_request_session.updatedTS, TEST_COUNTER + 1, 'TS must be increased')

        // Client side end

        let data_on_wire = client_request_session.request

        // Exit node side

        jest.setSystemTime(new Date(TEST_COUNTER + 10))

        let received_req_data: Envelope = {
            message: data_on_wire,
            entryPeerId: ENTRY_NODE,
            exitPeerId: EXIT_NODE
        }

        let exit_node_identity: Identity = {
            publicKey: fromHex(EXIT_NODE_PK),
            privateKey: fromHex(EXIT_NODE_SK)
        }

        let req_unbox_result = unbox_request(received_req_data, exit_node_identity, new Date(TEST_COUNTER))
        assert(!req_unbox_result.isErr, `request unboxing must not fail, error: ${req_unbox_result.message}`)

        let exit_request_session = req_unbox_result.session
        assert(exit_request_session != undefined, 'must contain a valid session')

        assert.equal(toHex(exit_request_session.request), TEST_VECTOR_REQUEST_INPUT)
        assert.equal(exit_request_session.updatedTS, TEST_COUNTER + 1)
    });

    it('test vectors on fixed response input', async function () {
        jest.useFakeTimers()
        jest.setSystemTime(new Date(TEST_COUNTER))

        // Exit node side

        let mock_session_with_client: Session = {
            updatedTS: BigInt(1),
            sharedPreSecret: fromHex(TEST_VECTOR_EPHEMERAL_SECRET)
        }

        let response_data: Envelope = {
            message: fromHex(TEST_VECTOR_RESPONSE_INPUT),
            entryPeerId: ENTRY_NODE,
            exitPeerId: EXIT_NODE
        }

        let resp_box_result = box_response(mock_session_with_client, response_data)
        assert(!resp_box_result.isErr, `response boxing must not fail, error: ${resp_box_result.message}`)

        assert(mock_session_with_client.response != undefined)
        assert.equal(toHex(mock_session_with_client.response), TEST_VECTOR_RESPONSE_OUTPUT)
        assert.equal(mock_session_with_client.updatedTS, TEST_COUNTER + 1)

        // Exit node side end

        let data_on_wire = mock_session_with_client.response

        // Client node side

        jest.setSystemTime(new Date(TEST_COUNTER + 10))

        let received_req_data: Envelope = {
            message: data_on_wire,
            entryPeerId: ENTRY_NODE,
            exitPeerId: EXIT_NODE
        }

        let mock_session_with_exit_node: Session = {
            updatedTS: BigInt(1),
            sharedPreSecret: fromHex(TEST_VECTOR_EPHEMERAL_SECRET)
        }

        let resp_unbox_result = unbox_response(mock_session_with_exit_node, received_req_data, new Date(TEST_COUNTER))
        assert(!resp_unbox_result.isErr, `response unboxing must not fail, error: ${resp_unbox_result.message}`)

        assert(mock_session_with_exit_node.response != undefined)
        assert.equal(toHex(mock_session_with_exit_node.response), TEST_VECTOR_RESPONSE_INPUT)
        assert.equal(mock_session_with_exit_node.updatedTS, TEST_COUNTER + 1)
    });
});