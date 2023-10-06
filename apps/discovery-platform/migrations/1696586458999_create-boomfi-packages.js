/* eslint-disable camelcase */

exports.up = (pgm) => {
  pgm.createTable("boomfi_packages", {
    id: "id",
    boomfi_package_id: { type: "varchar(255)", unique: true, notNull: true },
    package_id: { type: "uuid", references: "packages", notNull: true },
    created_at: "createdAt",
    updated_at: "timestamp",
  });

  pgm.createIndex("boomfi_packages", "package_id");
};
