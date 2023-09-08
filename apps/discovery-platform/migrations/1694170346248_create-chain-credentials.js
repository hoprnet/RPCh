/* eslint-disable camelcase */

exports.up = (pgm) =>
  pgm.createTable("chain_credentials", {
    user_id: { type: "uuid", references: "users", notNull: "true" },
    address: { type: "varchar(255)", notNull: true, unique: true },
    chain: { type: "varchar(255)", notNull: true },
  });
