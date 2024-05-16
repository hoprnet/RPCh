/* eslint-disable camelcase */

exports.up = (pgm) => {
    pgm.addColumn('vouchers', {
        uses_left: { type: 'integer' },
    });
};

exports.down = (pgm) => {
    pgm.dropColumns('vouchers', ['uses_left']);
};
