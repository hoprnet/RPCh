/* eslint-disable camelcase */

exports.up = (pgm) =>
    pgm.createTable('quotas', {
        client_id: { type: 'uuid', references: 'clients', notNull: true },
        count: { type: 'smallint', notNull: true },
        tag: 'varchar(20)',
        created_at: 'createdAt',
    });
