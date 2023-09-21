/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable("exit_node_tokens", {
    exit_id: { type: "uuid", references: "registered_nodes", notNull: "true" },
    external_token: { type: "varchar(255)", unique: true, notNull: "true" },
    invalidated_at: "timestamp",
    created_at: "createdAt",
    updated_at: "timestamp",
  });

  pgm.createIndex("exit_node_tokens", "exit_id");
};
