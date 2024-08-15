/* eslint-disable camelcase */

exports.up = (pgm) => {
    pgm.addColumn('request_quotas', {
        domain: { type: 'varchar(255)' },
    });

    pgm.addColumn('response_quotas', {
        domain: { type: 'varchar(255)' },
    });
};
