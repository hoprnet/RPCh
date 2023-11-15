/* eslint-disable camelcase */

exports.up = (pgm) => {
    pgm.dropTable('quotas');

    pgm.createTable('request_quotas', {
        id: 'id',
        client_id: { type: 'uuid', references: 'clients', notNull: true },
        rpc_method: { type: 'varchar(255)' },
        segment_count: { type: 'smallint', notNull: true },
        created_at: 'createdAt',
    });

    pgm.createTable('response_quotas', {
        id: 'id',
        client_id: { type: 'uuid', references: 'clients', notNull: true },
        rpc_method: { type: 'varchar(255)' },
        segment_count: { type: 'smallint', notNull: true },
        created_at: 'createdAt',
    });

    pgm.createIndex('request_quotas', 'client_id');
    pgm.createIndex('response_quotas', 'client_id');
};
