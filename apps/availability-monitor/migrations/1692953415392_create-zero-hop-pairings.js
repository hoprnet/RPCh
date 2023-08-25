const { PgLiteral } = require("node-pg-migrate");

/* eslint-disable camelcase */

exports.shorthands = {
  createdAt: {
    type: "timestamp",
    notNull: true,
    default: new PgLiteral("current_timestamp"),
  },
};

exports.up = (pgm) =>
  pgm.createTable("zero_hop_pairings", {
    entryNode: { type: "varchar", notNull: true },
    exitNode: { type: "varchar", notNull: true },
    createdAt: "createdAt",
  });
