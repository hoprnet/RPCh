/* eslint-disable camelcase */

exports.up = (pgm) => {
  dropFunctionsAndTriggers(pgm);
  updateMonthlyQuotaUsages(pgm);
  addSegmentSize(pgm);
  recreateAggregateQuota(pgm);
  recreateInitAggregatedQuota(pgm);
};

function dropFunctionsAndTriggers(pgm) {
  pgm.dropTrigger("request_quotas", "monthly_req_usage");
  pgm.dropTrigger("response_quotas", "monthly_resp_usage");
  pgm.dropTrigger("users", "init_monthly_usage");

  pgm.dropFunction("process_monthly_usage");
  pgm.dropFunction("process_initial_monthly_usage");
}

function updateMonthlyQuotaUsages(pgm) {
  // initialize then set not null
  pgm.addColumns("monthly_quota_usages", {
    req_segment_count: { type: "integer" },
    resp_segment_count: { type: "integer" },
  });

  // reset all columns to have matching data
  pgm.sql(
    "UPDATE monthly_quota_usages SET (req_count, resp_count, req_segment_count, resp_segment_count) = (0, 0, 0, 0)"
  );

  pgm.alterColumn("monthly_quota_usages", "req_count", {
    type: "integer",
    notNull: true,
  });
  pgm.alterColumn("monthly_quota_usages", "resp_count", {
    type: "integer",
    notNull: true,
  });
}

function addSegmentSize(pgm) {
  pgm.addColumns("request_quotas", {
    last_segment_length: { type: "smallint" },
  });
  pgm.addColumns("response_quotas", {
    last_segment_length: { type: "smallint" },
  });
}

function recreateAggregateQuota(pgm) {
  pgm.createFunction(
    "process_monthly_usage",
    [],
    { returns: "TRIGGER", language: "plpgsql" },
    `
    BEGIN
        IF (TG_TABLE_NAME = 'request_quotas') THEN
            UPDATE monthly_quota_usages SET (req_count, req_segment_count) = (1 + req_count, NEW.segment_count + req_segment_count) WHERE user_id = (SELECT user_id FROM clients WHERE id = NEW.client_id);
        ELSEIF (TG_TABLE_NAME = 'response_quotas') THEN
            UPDATE monthly_quota_usages SET (resp_count, resp_segment_count) = (1 + resp_count, NEW.segment_count + resp_segment_count) WHERE user_id = (SELECT user_id FROM clients WHERE id = NEW.client_id);
        END IF;
        RETURN NULL;
    END;
    `
  );

  pgm.createTrigger("request_quotas", "monthly_req_usage", {
    when: "AFTER",
    operation: "INSERT",
    level: "ROW",
    function: "process_monthly_usage",
  });
  pgm.createTrigger("response_quotas", "monthly_resp_usage", {
    when: "AFTER",
    operation: "INSERT",
    level: "ROW",
    function: "process_monthly_usage",
  });
}

function recreateInitAggregatedQuota(pgm) {
  pgm.createFunction(
    "process_initial_monthly_usage",
    [],
    { returns: "TRIGGER", language: "plpgsql" },
    `
    BEGIN
        INSERT INTO monthly_quota_usages (user_id, started_at, req_count, resp_count, req_segment_count, resp_segment_count) VALUES (NEW.id, NEW.created_at, 0, 0, 0, 0);
        RETURN NULL;
    END;
    `
  );

  pgm.createTrigger("users", "init_monthly_usage", {
    when: "AFTER",
    operation: "INSERT",
    level: "ROW",
    function: "process_initial_monthly_usage",
  });
}
