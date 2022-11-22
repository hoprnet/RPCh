# RPCh SDK

RPCh SDK is a library which will be used by a client who wants to access the RPCh network, additionally, the SDK will be integrated into our own “RPCh web3 adaptors”.
Through the SDK, the client should be able to send traffic through the RPCh network and maintain a reliability metric of used HOPR entry nodes.

### SDK Class

Upon initialization of the class, the SDK needs a startup sequence which will initialize SDK so RPC traffic can be sent through. This is done by requesting a list of registered HOPR entry nodes and a list of registered RPCh exit nodes from the Discovery Platform.

#### Interface

- constructor()
- fetchNodes(): pulls registered node list from the Discovery Platform
- createRequest(origin: string, provider: string, destination: string) -> Request
- sendRequest(request: Request, destination: string) -> Response | Timeout: sends Request to a register HOPRd exit node

### HOPRd

In this file, we export two functions that are used to interact with the selected HOPRd entry node.

#### Interface

- requestMessagingAccessToken(apiEndpoint: string, apiToken: string) -> string: request messaging access token from a selected HOPR entry node
- sendMessage(apiEndpoint: string, apiToken: string, message: string, destination: string): use HOPR entry node’s send message API
- createMessageListener(apiEndpoint: string, apiToken: string, onMessage: (message: string) -> void): listen to incoming messages from the HOPR entry node

### Request Cache

The Request Cache Class keeps in cache the Requests which have been sent by the SDK.
As soon as the upstream class finds a matching Response, it will remove the Request from the Request Cache.

#### Interface

- constructor(timeout: number)
- requests (Map<number, { request: Request, createdAt: Date }): keeps Requests in cache keyed by Request ID
- addRequest(req: Request): adds request to requests map
- removeRequest(req: Request): removes request from requests map
- setInterval(): check every “timeout” for expired Requests
