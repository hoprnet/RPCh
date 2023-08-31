/* eslint-disable camelcase */

exports.up = (pgm) =>
  pgm.alterColumn("registered_nodes", "updated_at", {
    notNull: false,
  });
