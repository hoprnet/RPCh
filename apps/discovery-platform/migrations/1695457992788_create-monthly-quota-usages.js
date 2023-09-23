/* eslint-disable camelcase */

exports.up = (pgm) => {
  pgm.createTable("monthly_quota_usages", {
    user_id: { type: "uuid", references: "users", notNull: true },
    started_at: { type: "timestamp", notNull: true },
    req_count: { type: "integer", notNull: true },
    resp_count: { type: "integer", notNull: true },
  });

  pgm.createIndex("monthly_quota_usages", "user_id");

  pgm.createFunction(
    "request_usages_counter",
    [],
    { returns: "TRIGGER" },
    `
    BEGIN
        UPDATE monthly_quota_usages SET req_count = new.segment_count WHERE user_id = (select user_id from clients where id = new.client_id);
        RETURN NULL;
    END;
    `
  );

  pgm.createTrigger("request_quotas", "request_usages_trigger", {
    when: "AFTER",
    after: "INSERT",
    function: "request_usages_counter",
    level: "ROW",
  });
};
