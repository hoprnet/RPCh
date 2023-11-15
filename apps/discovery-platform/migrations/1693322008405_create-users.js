/* eslint-disable camelcase */

exports.up = (pgm) =>
  pgm.createTable('users', {
    id: 'id',
    name: 'varchar(255)',
    email: 'varchar(255)',
    www_address: 'varchar(1000)',
    telegram: 'varchar(255)',
    last_logged_in_at: 'timestamp',
    created_at: 'createdAt',
    updated_at: 'timestamp',
  });
