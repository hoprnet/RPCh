# RPCh common library

## Description

RPCh common is a library which will be re-used throughout the RPCh codebase, it should contain all necessary code to achieve message segmentation, message reconstruction, segmentation caching, and lastly export other common utilities or fixtures.

### Segment class

A Segment is a class which can be serialized from and to a string.
Through the HOPR network, we send “Segments” as their body is ensured to be of size `< 500 bytes` which is a limitation of the HOPR protocol.
Segments are made by transforming a Message into multiple Segments.
Using the `toString` method, we can serialize the Segment into a string and send it through the HOPR network via the HOPRd API.

**It consists of:**

- message ID (number): the message ID from which the segment was created.
- segment number (number): the number of this segment (ex: 1 out of 10).
- number of segments (number): total number of all segments from a Message (ex: 10).
- body (string): partial body in plain text.

#### Interface

- ` constructor(message ID, segment number, number of segments, body)`
- ` fromString()`: Parse a given string into a Segment class.
- ` toString()`: Serialize a Segment class into a string.
  <br>

### Message class

A Message is a class which can be serialized from and to a string.
Due to the size limitations of the HOPR protocol, we are required to split apart a Message into Segments, these Segments are then sent through the HOPR network and reconstructed on the receiving end.

**It consists of:**

- ID (number): Randomly generated number.
- body (string): Body in plain text.

#### Interface

- ` constructor(ID, body)`
- ` fromSegments(segments: Segment[])`: Given an array of segments, reconstruct the message.
- ` toSegments()`: Given this Message, construct Segments.
  <br>

### Request class

A Request is a class which can be serialized from and to a Message class.

**It consists of:**

- ID (number): Randomly generated number.
- origin (string): PeerId of the creator of the request.
- provider (string): PRC provider.
- body (string): Body of RPC request.

#### Interface

- ` constructor(ID, origin, provider, body)`
- ` fromData(origin, provider, body)`: Create a Request.
- ` fromMessage(message: Message)`: Given a Message, create a Request by parsing its body into `(origin, provider, body)`.
- ` toMessage()`: Given this Request, concatenate `(origin, provider, body)` into a single body and create a Message.
- ` createResponse()`: Given this Request, create a Response with the same `ID`.
  <br>

### Response class

A Response is a class which can be serialized from and to a Message.

**It consists of:**

- ID (number): Randomly generated number.
- body (string): Body of RPC response.

#### Interface

- ` constructor(ID, body)`
- ` fromMessage(message: Message)`: Given a Message, create a Response (no need for additional concatenation).
- ` toMessage()`: Given this Response, create a Message (no need for additional parsing).
  <br>

### Cache class

As there is a need to await for incoming Segments and then subsequently transform them into a Message which can either be a Request or a Response, we need a generalized class to store them in memory and ensure that once a valid Message can be created it is created and the Segments are removed from memory.
Additionally, the Cache class needs to notify the upstream code so then the codebase can take action.

**It consists of:**

- timeout (number): How often should tangling Segments be discarded.
- segments (Map <number, { segments: Segment[], receivedAt: Date}> ): Keeps Segments in cache keyed by Message ID.
- onRequest(req: Request): Triggered by Cache once a valid Request is constructed.
- onResponse(res: Response): Triggered by Cache once a valid Response is constructed.
- onSegment(seq: Segment): Triggered by upstream with a new Segment.
- setInterval: Check every “timeout” for expired Segments.

#### Interface

- ` constructor(timeout, onRequest, onResponse)`
- ` onSegment(segment: Segment)`
- ` toMessage()`
