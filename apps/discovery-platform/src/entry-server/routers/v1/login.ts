// @ts-ignore
import EthereumStrategy, { SessionNonceStore } from "passport-ethereum-siwe";
import passport from "passport";

import * as q from "../../../query";
import { createLogger } from "../../../utils";

import type { Pool, QueryResult } from "pg";

const log = createLogger(["router", "login"]);

export function setup(dbPool: Pool) {
  const store = new SessionNonceStore();

  passport.use(
    new EthereumStrategy({ store: store }, function verify(
      address: string,
      cb: (err: Error) => {}
    ) {
      q.readLogin(dbPool, address, "eip155:1")
        .then((res) => login(dbPool, address, res))
        .catch((err) => {
          log.error("Error during readLogin query", err);
          cb(err);
        });
    })
  );

  function login(
    dbPool: Pool,
    address: string,
    res: QueryResult<{ user_id: string }>
  ) {
    if (res.rowCount === 0) {
      // create user
      q.createUser(dbPool, {}).then((res) => res);
    }
  }
}
//
//
//     ], function(err, row) {
//       if (err) { return cb(err); }
//       if (!row) {
//         db.run('INSERT INTO users (username) VALUES (?)', [
//           address
//         ], function(err) {
//           if (err) { return cb(err); }
//           var id = this.lastID;
//           db.run('INSERT INTO blockchain_credentials (user_id, chain, address) VALUES (?, ?, ?)', [
//             id,
//             'eip155:1',
//             address
//           ], function(err) {
//             if (err) { return cb(err); }
//             var user = {
//               id: id,
//               username: address
//             };
//             return cb(null, user);
//           });
//         });
//       } else {
//         db.get('SELECT rowid AS id, * FROM users WHERE rowid = ?', [ row.user_id ], function(err, row) {
//           if (err) { return cb(err); }
//           if (!row) { return cb(null, false); }
//           return cb(null, row);
//         });
//       }
//     });
//   }
// ));
//
// var store = new SessionChallengeStore();
//
//
// export function challenge(req, res) {
//
//   store.challenge(req, function(err, nonce) {
//     if (err) { return next(err); }
//     res.json({ nonce: nonce });
//   });
// });
