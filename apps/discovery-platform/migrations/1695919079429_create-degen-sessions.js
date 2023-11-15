/* eslint-disable camelcase */

exports.up = (pgm) => {
  pgm.createTable('degen_sessions', {
    sid: { type: 'varchar(255)', primaryKey: true },
    sess: { type: 'json', notNull: true },
    expire: { type: 'timestamp(6)', notNull: true },
  });

  pgm.createIndex('degen_sessions', 'expire');
};
