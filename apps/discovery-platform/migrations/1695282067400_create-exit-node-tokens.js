/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
    pgm.createTable('exit_node_tokens', {
        id: 'id',
        exit_id: {
            type: 'varchar(255)',
            references: 'registered_nodes',
            notNull: 'true',
        },
        access_token: { type: 'varchar(255)', unique: true, notNull: 'true' },
        invalidated_at: 'timestamp',
        created_at: 'createdAt',
        updated_at: 'timestamp',
    });

    pgm.createIndex('exit_node_tokens', 'exit_id');
};
