import { MigrationBuilder } from "node-pg-migrate";

export const up = async (pgm: MigrationBuilder) => {
  await pgm.addColumn("quotas", {
    paid_by: { type: "varchar(255)", notNull: true, references: "clients(id)" },
  });
};

export const down = async (pgm: MigrationBuilder) => {
  await pgm.dropColumn("quotas", "paid_by");
};
