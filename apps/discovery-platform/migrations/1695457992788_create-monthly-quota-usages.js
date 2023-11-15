/* eslint-disable camelcase */

exports.up = (pgm) => {
  pgm.createTable('monthly_quota_usages', {
    user_id: { type: 'uuid', references: 'users', notNull: true },
    started_at: { type: 'timestamp', notNull: true },
    req_count: { type: 'integer', notNull: true },
    resp_count: { type: 'integer', notNull: true },
  });

  pgm.createIndex('monthly_quota_usages', 'user_id');
};
