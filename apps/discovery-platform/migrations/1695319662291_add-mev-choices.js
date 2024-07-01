/* eslint-disable camelcase */

exports.up = (pgm) =>
    pgm.addColumns('users', {
        mev_kickback_address: { type: 'varchar(255)' },
        mev_current_choice: { type: 'varchar(255)' },
    });
