import { MigrationBuilder, ColumnDefinitions } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

exports.up = async (pgm) => {
  await pgm.addColumn("quotas", {
    paid_by: { type: "varchar(255)", notNull: true, references: "clients(id)" },
  });
};

exports.down = async (pgm) => {
  await pgm.dropColumn("quotas", "paid_by");
};
