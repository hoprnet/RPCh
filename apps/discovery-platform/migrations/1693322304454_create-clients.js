/* eslint-disable camelcase */

exports.up = (pgm) =>
  pgm.createTable("clients", {
    id: "id",
    user_id: { type: "uuid", references: "users", notNull: "true" },
    external_token: { type: "varchar(255)", unique: true, notNull: "true" },
    invalidated_at: "timestamp",
    created_at: "created_at",
    updated_at: "timestamp",
  });
