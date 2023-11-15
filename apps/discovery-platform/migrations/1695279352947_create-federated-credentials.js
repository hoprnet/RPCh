/* eslint-disable camelcase */

exports.up = (pgm) => {
    // add missing index from previous migration
    pgm.createIndex('chain_credentials', 'user_id');

    pgm.createTable('federated_credentials', {
        id: 'id',
        user_id: { type: 'uuid', references: 'users', notNull: 'true' },
        provider: { type: 'varchar(255)', notNull: true },
        subject: { type: 'varchar(255)', notNull: true },
    });

    pgm.createIndex('federated_credentials', 'user_id');
};
