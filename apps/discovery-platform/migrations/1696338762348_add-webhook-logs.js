/* eslint-disable camelcase */

exports.up = (pgm) => {
  // Create the webhook_logs table
  pgm.createTable("webhook_logs", {
    id: {
      type: "uuid",
      default: pgm.func("gen_random_uuid()"),
      primaryKey: true,
      notNull: true,
      comment: "Identifier of the log entry",
    },
    event_type: {
      type: "varchar(255)",
      notNull: true,
      comment: "Type of the event, e.g., Subscription.Created",
    },
    event_data: {
      type: "jsonb",
      notNull: true,
      comment: "Payload of the webhook event",
    },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("current_timestamp"),
      comment: "When the webhook was received",
    },
  });
};

exports.down = (pgm) => {
  // Drop the webhook_logs table
  pgm.dropTable("webhook_logs");
};
