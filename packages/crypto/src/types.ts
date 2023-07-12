export class Identity {
  constructor(
    public readonly pubKey: Uint8Array,
    public readonly privKey?: Uint8Array
  ) {
    // TODO: add verifications
  }
}

export class Session {
  constructor(
    public readonly counter: bigint,
    public readonly sharedPresecret: Uint8Array,
    public readonly reqData?: Uint8Array,
    public readonly resData?: Uint8Array
  ) {}
}

export class Envelope {
  constructor(
    public readonly entryPubKey: Uint8Array,
    public readonly exitPubKey: Uint8Array,
    public readonly message: Uint8Array
  ) {}
}
