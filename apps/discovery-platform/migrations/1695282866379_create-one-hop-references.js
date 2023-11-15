/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('one_hop_pairings', {
    entry_id: {
      type: 'varchar(255)',
      references: 'registered_nodes',
      notNull: 'true',
    },
    exit_id: {
      type: 'varchar(255)',
      references: 'registered_nodes',
      notNull: 'true',
    },
    created_at: 'createdAt',
  });

  pgm.createIndex('one_hop_pairings', ['entry_id', 'exit_id'], {
    unique: true,
  });

  pgm.createIndex('one_hop_pairings', 'entry_id');
  pgm.createIndex('one_hop_pairings', 'exit_id');
};
