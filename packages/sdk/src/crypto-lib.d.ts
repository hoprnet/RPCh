/* tslint:disable */
/* eslint-disable */
/**
 * @param {Envelope} request
 * @param {Identity} exit_node
 * @returns {Session}
 */
export function box_request(request: Envelope, exit_node: Identity): Session;
/**
 * @param {Envelope} message
 * @param {Identity} my_id
 * @returns {Session}
 */
export function unbox_request(message: Envelope, my_id: Identity): Session;
/**
 * @param {Session} session
 * @param {Envelope} response
 * @param {Identity} client
 */
export function box_response(
  session: Session,
  response: Envelope,
  client: Identity
): void;
/**
 * @param {Session} session
 * @param {Envelope} message
 * @param {Identity} my_id
 */
export function unbox_response(
  session: Session,
  message: Envelope,
  my_id: Identity
): void;
/**
 */
export function set_panic_hook(): void;
/**
 */
export class Envelope {
  free(): void;
  /**
   * @param {Uint8Array} message
   * @param {string} entry_peer_id
   * @param {string} exit_peer_id
   */
  constructor(message: Uint8Array, entry_peer_id: string, exit_peer_id: string);
}
/**
 */
export class Identity {
  free(): void;
  /**
   * @param {Uint8Array} public_key
   * @param {Uint8Array | undefined} private_key
   * @param {bigint | undefined} counter
   * @returns {Identity}
   */
  static load_identity(
    public_key: Uint8Array,
    private_key?: Uint8Array,
    counter?: bigint
  ): Identity;
}
/**
 */
export class Session {
  free(): void;
  /**
   * @returns {boolean}
   */
  valid(): boolean;
  /**
   * @returns {Uint8Array}
   */
  get_request_data(): Uint8Array;
  /**
   * @returns {Uint8Array}
   */
  get_response_data(): Uint8Array;
  /**
   * @returns {Uint8Array}
   */
  get_client_public_key(): Uint8Array;
  /**
   * @returns {Uint8Array}
   */
  get_exit_node_public_key(): Uint8Array;
  /**
   * @returns {bigint}
   */
  get_client_node_counter(): bigint;
  /**
   * @returns {bigint}
   */
  get_exit_node_counter(): bigint;
}
