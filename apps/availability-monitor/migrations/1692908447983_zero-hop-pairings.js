/* eslint-disable camelcase */

exports.shorthands = {
  createdAt: {
    type: "timestamp",
    notNull: true,
    default: new PgLiteral("current_timestamp"),
  },
};

exports.up = (pgm) =>
  pgm.createTable("test", {
    entryNode: "string",
    exitNode: "string",
    createdAt: "createdAt",
  });
