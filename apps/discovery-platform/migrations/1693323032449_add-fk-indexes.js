/* eslint-disable camelcase */

exports.up = (pgm) => {
  // add indexes for faster fk scans
  pgm.createIndex("clients", "user_id");
  pgm.createIndex("quotas", "client_id");
  pgm.createIndex("zero_hop_pairings", "entry_id");
  pgm.createIndex("zero_hop_pairings", "exit_id");
};
