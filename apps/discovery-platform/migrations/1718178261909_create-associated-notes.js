/* eslint-disable camelcase */

exports.up = (pgm) =>
    pgm.createTable('associated_nodes', {
        user_id: { type: 'uuid', references: 'users', notNull: true },
        node_id: { type: 'varchar(255)', references: 'registered_nodes', notNull: true },
        created_at: 'createdAt',
    });
