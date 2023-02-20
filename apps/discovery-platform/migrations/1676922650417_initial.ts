import { MigrationBuilder, ColumnDefinitions } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

exports.up = async (pgm) => {
  await pgm.createType("payment_type", ["trial", "premium"]);

  await pgm.createTable("clients", {
    id: { type: "varchar(255)", primaryKey: true },
    labels: { type: "text[]" },
    payment: { type: "payment_type", notNull: true },
    created_at: {
      type: "timestamptz",
      default: pgm.func("current_timestamp"),
      notNull: true,
    },
    updated_at: {
      type: "timestamptz",
      default: pgm.func("current_timestamp"),
      notNull: true,
    },
  });

  await pgm.createTable("registered_nodes", {
    id: { type: "varchar(255)", notNull: true, primaryKey: true },
    has_exit_node: { type: "boolean", notNull: true, default: false },
    chain_id: { type: "integer", notNull: true },
    hoprd_api_endpoint: { type: "varchar(255)", notNull: true },
    hoprd_api_token: { type: "varchar(255)", notNull: true },
    exit_node_pub_key: { type: "varchar(255)" },
    native_address: { type: "varchar(255)", notNull: true },
    total_amount_funded: { type: "numeric", notNull: true },
    honesty_score: { type: "numeric", notNull: true },
    reason: { type: "varchar(255)" },
    status: { type: "varchar(255)", notNull: true },
    created_at: {
      type: "timestamptz",
      default: pgm.func("current_timestamp"),
      notNull: true,
    },
    updated_at: {
      type: "timestamptz",
      default: pgm.func("current_timestamp"),
      notNull: true,
    },
  });

  await pgm.createTable("quotas", {
    id: { type: "serial", primaryKey: true },
    client_id: {
      type: "varchar(255)",
      notNull: true,
      references: "clients(id)",
    },
    quota: { type: "integer", notNull: true },
    action_taker: { type: "varchar(255)", notNull: true },
    created_at: {
      type: "timestamptz",
      default: pgm.func("current_timestamp"),
      notNull: true,
    },
    updated_at: {
      type: "timestamptz",
      default: pgm.func("current_timestamp"),
      notNull: true,
    },
  });

  await pgm.createTable("funding_requests", {
    id: { type: "serial", primaryKey: true },
    registered_node_id: {
      type: "varchar(255)",
      notNull: true,
      references: "registered_nodes(id)",
    },
    request_id: { type: "integer", notNull: true },
    amount: { type: "text", notNull: true },
    created_at: {
      type: "timestamptz",
      default: pgm.func("current_timestamp"),
      notNull: true,
    },
    updated_at: {
      type: "timestamptz",
      default: pgm.func("current_timestamp"),
      notNull: true,
    },
  });
};
exports.down = async (pgm) => {
  await pgm.dropTable("funding_requests");
  await pgm.dropTable("registered_nodes");
  await pgm.dropTable("quotas");
  await pgm.dropTable("clients");
  await pgm.dropType("payment_type");
};
