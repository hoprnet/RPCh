// load `rpc-h/crypto` crate
import init, {
  set_panic_hook as rpch_crypto_misc_panic_hook,
} from "./lib/rpch-crypto/pkg/rpch_crypto";

init().then(() => rpch_crypto_misc_panic_hook());

export * from "./lib/rpch-crypto/pkg/rpch_crypto";
