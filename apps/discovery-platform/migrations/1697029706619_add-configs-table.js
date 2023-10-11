/* eslint-disable camelcase */

exports.up = (pgm) => {
  pgm.createTable("configs", {
    key: { type: "varchar(255)", primaryKey: true },
    data: { type: "text", notNull: true },
    created_at: "createdAt",
    updated_at: "timestamp",
  });
};
