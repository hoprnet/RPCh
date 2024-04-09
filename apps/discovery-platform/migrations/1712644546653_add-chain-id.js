/* eslint-disable camelcase */

exports.up = (pgm) => {
    pgm.addColumn('request_quotas', {
        chain_id: {
            type: 'varchar(255)',
        },
    });

    pgm.addColumn('response_quotas', {
        chain_id: {
            type: 'varchar(255)',
        },
    });
};
