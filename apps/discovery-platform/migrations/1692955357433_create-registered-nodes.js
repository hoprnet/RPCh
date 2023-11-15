const { PgLiteral } = import('node-pg-migrate');

/* eslint-disable camelcase */

exports.shorthands = {
    id: { type: 'uuid', primaryKey: true },
    createdAt: {
        type: 'timestamp',
        notNull: true,
        default: new PgLiteral('current_timestamp'),
    },
};

exports.up = (pgm) => {
    pgm.createTable('registered_nodes', {
        id: { type: 'varchar(255)', primaryKey: true },
        is_exit_node: { type: 'boolean', notNull: true },
        chain_id: { type: 'integer', notNull: true },
        hoprd_api_endpoint: { type: 'varchar(255)', notNull: true },
        hoprd_api_token: { type: 'varchar(255)', notNull: true },
        exit_node_pub_key: 'varchar(255)',
        native_address: { type: 'varchar(255)', notNull: true },
        created_at: 'createdAt',
        updated_at: { type: 'timestamp', notNull: true },
    });
};
