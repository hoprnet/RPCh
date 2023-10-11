/* eslint-disable camelcase */

exports.up = (pgm) => {
  pgm.createTable("config", {
    key: { type: "text", primaryKey: true },
    data: { type: "text", notNull: true },
    created_at: "createdAt",
    updated_at: "timestamp",
  });
};

exports.down = (pgm) => {
  pgm.dropTable("config");
};
