/* eslint-disable camelcase */

exports.up = (pgm) => {
    pgm.createTable('zero_hop_pairings', {
        entry_id: { type: 'varchar', notNull: true },
        exit_id: { type: 'varchar', notNull: true },
        created_at: 'createdAt',
    });
    pgm.createIndex('zero_hop_pairings', ['entry_id', 'exit_id'], {
        unique: true,
    });
};
