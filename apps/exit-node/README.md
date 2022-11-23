# RPCh Exit Node

RPCh Exit Node is an application which will be able to fulfil RPC requests and return them back. It awaits for incoming requests and will perform an external request to the embedded provider URL and return the response.

### Exit Node

Upon start, the exit node will create a message listener, where it will receive requests and resolve them. It will store the requests for a set time until they are resolved or they will be removed.

#### Interface

- start({apiEndpoint: string; apiToken: string; timeout: number;}) -> Promise\<void>: Create message listener and wait for requests to fulfil.

### Exit 

In this file, we export one function that is used to send the RPC Requests and return the response.

#### Interface

- sendRpcRequests(body: string, provider: string) -> Promise\<string>: Sends the Rpc request to the given provider and given body and returns the response.

### HOPRd

In this file, we export two functions that are used to interact with the selected HOPRd entry node.

#### Interface

- sendMessage(apiEndpoint: string, apiToken: string, message: string, destination: string): use HOPR entry node’s send message API.
- createMessageListener(apiEndpoint: string, apiToken: string, onMessage: (message: string) -> void): listen to incoming messages from the HOPR entry node.

### Request Tracker

The Request Tracker Class keeps in cache the Requests which have been sent to the exit node.
As soon as the request has been resolved it finds a matching Response, it will remove the Request from the Request Tracker.

#### Interface

- constructor(timeout: number)
- requests (Map<number, { request: Request, receivedAt: Date }>): keeps Requests in cache keyed by Request ID.
- onRequest(request: Request): adds request to requests map.
- onResponse(respose: Response): removes request from requests map.
- setInterval(): check every “timeout” for expired Requests.
