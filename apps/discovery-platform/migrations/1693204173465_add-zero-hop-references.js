/* eslint-disable camelcase */

exports.up = (pgm) => {
  pgm.alterColumn("zero_hop_pairings", "entry_id", {
    type: "varchar(255)",
    notNull: true,
  });
  pgm.alterColumn("zero_hop_pairings", "exit_id", {
    type: "varchar(255)",
    notNull: true,
  });
  pgm.addConstraint(
    "zero_hop_pairings",
    "zero_hop_pairings_entry_id_fkey",
    "FOREIGN KEY (entry_id) REFERENCES registered_nodes(id)"
  );
  pgm.addConstraint(
    "zero_hop_pairings",
    "zero_hop_pairings_exit_id_fkey",
    "FOREIGN KEY (exit_id) REFERENCES registered_nodes(id)"
  );
};
