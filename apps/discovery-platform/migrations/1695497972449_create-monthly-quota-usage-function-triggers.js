/* eslint-disable camelcase */

exports.up = (pgm) => {
  // aggregate quota
  pgm.createFunction(
    'process_monthly_usage',
    [],
    { returns: 'TRIGGER', language: 'plpgsql' },
    `
    BEGIN
        IF (TG_TABLE_NAME = 'request_quotas') THEN
            UPDATE monthly_quota_usages SET req_count = (NEW.segment_count + req_count) WHERE user_id = (SELECT user_id FROM clients WHERE id = NEW.client_id);
        ELSEIF (TG_TABLE_NAME = 'response_quotas') THEN
            UPDATE monthly_quota_usages SET resp_count = (NEW.segment_count + resp_count) WHERE user_id = (SELECT user_id FROM clients WHERE id = NEW.client_id);
        END IF;
        RETURN NULL;
    END;
    `
  );

  pgm.createTrigger('request_quotas', 'monthly_req_usage', {
    when: 'AFTER',
    operation: 'INSERT',
    level: 'ROW',
    function: 'process_monthly_usage',
  });
  pgm.createTrigger('response_quotas', 'monthly_resp_usage', {
    when: 'AFTER',
    operation: 'INSERT',
    level: 'ROW',
    function: 'process_monthly_usage',
  });

  // initialze aggregated quota
  pgm.createFunction(
    'process_initial_monthly_usage',
    [],
    { returns: 'TRIGGER', language: 'plpgsql' },
    `
    BEGIN
        INSERT INTO monthly_quota_usages (user_id, started_at, req_count, resp_count) VALUES (NEW.id, NEW.created_at, 0, 0);
        RETURN NULL;
    END;
    `
  );

  pgm.createTrigger('users', 'init_monthly_usage', {
    when: 'AFTER',
    operation: 'INSERT',
    level: 'ROW',
    function: 'process_initial_monthly_usage',
  });

  // initialize already existing
  pgm.sql(
    `
    INSERT INTO monthly_quota_usages (user_id, started_at, req_count, resp_count)
        SELECT id, created_at, 0, 0 from USERS WHERE id NOT IN
            (SELECT user_id FROM monthly_quota_usages);
    `
  );
};
