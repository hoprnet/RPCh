/* eslint-disable camelcase */

exports.up = (pgm) =>
  pgm.addConstraint('clients', 'external_token_check', {
    check: 'char_length(external_token) >= 10',
  });
