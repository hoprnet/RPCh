// @ts-ignore
import EthereumStrategy, { SessionNonceStore } from "passport-ethereum-siwe";
import passport from "passport";

import * as q from "../../../query";
import { createLogger } from "../../../utils";

import type { Pool, QueryResult } from "pg";
import type { Request, Response } from "express";

export type Login = {
  store: SessionNonceStore;
};

const log = createLogger(["router", "login"]);

const chainId = "eip155:1";

type VerifyCb = (err?: Error, userId?: string) => {};

export function create(dbPool: Pool): Login {
  const store = new SessionNonceStore();
  const lState = { store };

  passport.use(
    new EthereumStrategy(lState, function verify(
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

  return lState;
}

export function challenge({ store }: Login) {
  return function (req: Request, res: Response) {
    store.challenge(req, function (err: Error, nonce: string) {
      if (err) {
        log.error("Challenge error", err);
        const reason = "Internal server error";
        return res.status(500).json({ reason });
      }
      return res.status(201).json({ nonce });
    });
  };
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
