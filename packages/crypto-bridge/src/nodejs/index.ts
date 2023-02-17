// @ts-nocheck
import { set_panic_hook } from "@rpch/crypto/nodejs";
globalThis.crypto = require("node:crypto").webcrypto;

set_panic_hook();

export * from "@rpch/crypto/nodejs";
