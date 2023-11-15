/* eslint-disable camelcase */

exports.up = (pgm) => {
    pgm.addColumn('request_quotas', {
        reported_by_id: {
            type: 'varchar(255)',
            references: 'registered_nodes',
            notNull: true,
        },
    });
    pgm.createIndex('request_quotas', 'reported_by_id');

    pgm.addColumn('response_quotas', {
        reported_by_id: {
            type: 'varchar(255)',
            references: 'registered_nodes',
            notNull: true,
        },
    });
    pgm.createIndex('response_quotas', 'reported_by_id');
};
