// @ts-ignore
import EthereumStrategy, { SessionNonceStore } from "passport-ethereum-siwe";
import passport from "passport";

import * as q from "../../../query";
import { createLogger } from "../../../utils";

import type { Pool, QueryResult } from "pg";

const log = createLogger(["router", "login"]);

const chainId = "eip155:1";

type VerifyCb = (err?: Error, userId?: string) => {};

export function setup(dbPool: Pool) {
  const store = new SessionNonceStore();

  passport.use(
    new EthereumStrategy({ store: store }, function verify(
      address: string,
      cb: VerifyCb
    ) {
      q.readLogin(dbPool, address, chainId)
        .then((res) => login(dbPool, address, res, cb))
        .catch((err) => {
          log.error("Error during readLogin query", err);
          cb(err);
        });
    })
  );
}

async function login(
  dbPool: Pool,
  address: string,
  res: QueryResult<{ user_id: string }>,
  cb: (err?: Error, userId?: string) => {}
) {
  if (res.rowCount === 0) {
    return createLogin(dbPool, address, cb);
  }
  if (res.rowCount === 1) {
    return cb(undefined, res.rows[0].user_id);
  }
  const reason = "Wrong rowCount from readLogin query";
  log.error(reason, res);
  return cb(new Error(reason));
}

function createLogin(dbPool: Pool, address: string, cb: VerifyCb) {
  q.createUser(dbPool, {})
    .then((res) => {
      if (res.rowCount !== 1) {
        const reason = "Wrong rowCount from createUser query";
        log.error(reason, res);
        return cb(new Error(reason));
      }
      const userId = res.rows[0].id;
      q.createChainCredential(dbPool, {
        user_id: userId,
        address,
        chain: chainId,
      })
        .then(() => cb(undefined, userId))
        .catch((err) => {
          log.error("Error during createChainCredential query", err);
          return cb(err);
        });
    })
    .catch((err) => {
      log.error("Error during createUser query", err);
      return cb(err);
    });
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
