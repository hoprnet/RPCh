const { PgLiteral } = require("node-pg-migrate");

/* eslint-disable camelcase */

exports.shorthands = {
  createdAt: {
    type: "timestamp",
    notNull: true,
    default: new PgLiteral("current_timestamp"),
  },
};

exports.up = (pgm) => {
  pgm.createTable("zero_hop_pairings", {
    entry_id: { type: "varchar", notNull: true },
    exit_id: { type: "varchar", notNull: true },
    created_at: "createdAt",
  });
  pgm.createIndex("zero_hop_pairings", ["entry_id", "exit_id"], {
    unique: true,
  });
};
