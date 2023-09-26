/* eslint-disable camelcase */

exports.up = (pgm) =>
  pgm.addColumn("clients", {
    name: { type: "varchar(255)" },
  });
