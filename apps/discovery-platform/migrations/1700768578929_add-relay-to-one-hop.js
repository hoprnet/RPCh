/* eslint-disable camelcase */

exports.up = (pgm) => {
    pgm.addColumn('one_hop_pairings', {
        relay_id: {
            type: 'varchar(255)',
            references: 'registered_nodes',
        },
    });

    pgm.dropIndex('one_hop_pairings', ['entry_id', 'exit_id']);
    pgm.createIndex('one_hop_pairings', ['entry_id', 'exit_id', 'relay_id'], {
        unique: true,
    });

    pgm.createIndex('one_hop_pairings', 'relay_id');
};
