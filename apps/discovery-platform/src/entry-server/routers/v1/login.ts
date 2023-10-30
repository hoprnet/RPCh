import { Utils } from '@rpch/sdk';
// @ts-ignore
import EthereumStrategy, { SessionNonceStore } from 'passport-ethereum-siwe-2';
// @ts-ignore
import GoogleStrategy from 'passport-google-oidc';
import passport from 'passport';

import * as q from '../../../query';

import type { Pool, QueryResult } from 'pg';
import type { Request, Response } from 'express';

import type { Secrets } from './../../../secrets';

export type Login = {
    store: SessionNonceStore;
};

const log = Utils.logger(['discovery-platform', 'router', 'login']);

const chainId = 'eip155:1';

type VerifyCb = (err?: Error, user?: q.User | false) => {};

export function create(dbPool: Pool, secrets: Secrets, url: string): Login {
    const store = new SessionNonceStore();
    const lState = { store };

    passport.use(
        new EthereumStrategy(lState, function verify(address: string, cb: VerifyCb) {
            q.readUserByChainCred(dbPool, address, chainId)
                .then((res) => loginChain(dbPool, address, res, cb))
                .catch((err) => {
                    log.error('Error during readUserByChainCred query', err);
                    cb(err);
                });
        })
    );

    const cbURL = new URL('oauth2/redirect/google', url);
    passport.use(
        new GoogleStrategy(
            {
                clientID: secrets.googleClientID,
                clientSecret: secrets.googleClientSecret,
                callbackURL: cbURL.toString(),
            },
            function (issuer: string, profile: { id: string; displayName: string }, cb: VerifyCb) {
                q.readUserByFederatedCred(dbPool, issuer, profile.id)
                    .then((res) => loginFederated(dbPool, issuer, profile, res, cb))
                    .catch((err) => {
                        log.error('Error during readUserByFederatedCred query', err);
                        cb(err);
                    });
            }
        )
    );

    passport.serializeUser(function (user, done) {
        process.nextTick(function () {
            if ('id' in user) {
                done(null, user.id);
            } else {
                const reason = 'Encountered unexpected user object during serialization';
                log.error(reason);
                done(new Error(reason));
            }
        });
    });

    passport.deserializeUser(function (id, done) {
        process.nextTick(function () {
            if (typeof id === 'string') {
                q.readUserById(dbPool, id)
                    .then((res) => {
                        if (res.rowCount === 0) {
                            return done(new Error('no user'));
                        }
                        done(null, res.rows[0]);
                    })
                    .catch((err) => {
                        log.error('Error during readUserById query', err);
                        done(err);
                    });
            } else {
                const reason = 'Encountered unexpted id during deserialization';
                log.error(reason);
                done(reason);
            }
        });
    });

    return lState;
}

export function challenge({ store }: Login) {
    return function (req: Request, res: Response) {
        store.challenge(req, function (err: Error, nonce: string) {
            if (err) {
                log.error('Challenge error', err);
                const reason = 'Internal server error';
                return res.status(500).json({ reason });
            }
            req.session.save((err) => {
                if (err) {
                    log.error('Error saving session', err);
                    return res.status(403).json({});
                } else {
                    return res.status(201).json({ nonce });
                }
            });
        });
    };
}

export function signin() {
    return function (req: Request, res: Response) {
        req.session.save((err) => {
            if (err) {
                log.error('Error saving session', err);
                res.status(403).json({ ok: false });
            } else {
                res.status(200).json({ ok: true });
            }
        });
    };
}

function loginChain(dbPool: Pool, address: string, res: QueryResult<q.User>, cb: VerifyCb) {
    if (res.rowCount === 0) {
        return createChainLogin(dbPool, address, cb);
    }
    if (res.rowCount === 1) {
        return cb(undefined, res.rows[0]);
    }
    const reason = 'Wrong rowCount from readUserByChainCred query';
    log.error(reason, res);
    return cb(new Error(reason));
}

function createChainLogin(dbPool: Pool, address: string, cb: VerifyCb) {
    q.createUser(dbPool, {})
        .then((res) => {
            if (res.rowCount !== 1) {
                const reason = 'Wrong rowCount from createUser query';
                log.error(reason, res);
                return cb(new Error(reason));
            }
            const user = res.rows[0];
            q.createChainCredential(dbPool, {
                user_id: user.id,
                address,
                chain: chainId,
            })
                .then(() => cb(undefined, user))
                .catch((err) => {
                    log.error('Error during createChainCredential query', err);
                    return cb(err);
                });
        })
        .catch((err) => {
            log.error('Error during createUser query', err);
            return cb(err);
        });
}

function loginFederated(
    dbPool: Pool,
    issuer: string,
    profile: { id: string; displayName: string },
    res: QueryResult<q.User>,
    cb: VerifyCb
) {
    if (res.rowCount === 0) {
        return createFederatedLogin(dbPool, issuer, profile, cb);
    }
    if (res.rowCount === 1) {
        return cb(undefined, res.rows[0]);
    }
    const reason = 'Wrong rowCount from readUserByFederatedCred query';
    log.error(reason, res);
    return cb(new Error(reason));
}

function createFederatedLogin(
    dbPool: Pool,
    issuer: string,
    profile: { id: string; displayName: string },
    cb: VerifyCb
) {
    q.createUser(dbPool, { name: profile.displayName })
        .then((res) => {
            if (res.rowCount !== 1) {
                const reason = 'Wrong rowCount from createUser query';
                log.error(reason, res);
                return cb(new Error(reason));
            }
            const user = res.rows[0];
            q.createFederatedCredential(dbPool, {
                user_id: user.id,
                provider: issuer,
                subject: profile.id,
            })
                .then(() => cb(undefined, user))
                .catch((err) => {
                    log.error('Error during createFederatedCredential query', err);
                    return cb(err);
                });
        })
        .catch((err) => {
            log.error('Error during createUser query', err);
            return cb(err);
        });
}
