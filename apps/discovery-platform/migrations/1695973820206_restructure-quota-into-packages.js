/* eslint-disable camelcase */

exports.up = (pgm) => {
  pgm.dropTable('packages_quota_bundles');
  pgm.dropTable('vouchers_quota_bundles');
  pgm.dropTable('quota_bundles');

  // table is empty so we can add not null column directly
  pgm.addColumn('packages', {
    segment_count_per_month: { type: 'integer', notNull: true },
  });
  // disable this until we have billing_schemes
  pgm.alterColumn('packages', 'billing_scheme_id', {
    type: 'uuid',
    references: 'billing_scheme',
    notNull: false,
  });

  // create nullable -> add data -> make not nullable
  pgm.addColumn('vouchers', {
    package_id: { type: 'uuid', references: 'packages' },
  });

  createDefaultPackages(pgm);
  createDefaultVouchers(pgm);
  updateExistingVouchers(pgm);

  pgm.alterColumn('vouchers', 'package_id', {
    type: 'uuid',
    references: 'packages',
    notNull: true,
  });

  pgm.createIndex('vouchers', 'package_id');
};

function createDefaultPackages(pgm) {
  const sql = [
    'insert into packages (id, name, "desc", segment_count_per_month, created_at) values',
    "(gen_random_uuid(), 'casual', '3 trades per week - 3 hours of DeFi browsing', 178000, now()),",
    "(gen_random_uuid(), 'trader', '12 trades per week - 12 hours of DeFi browsing', 605200, now()),",
    "(gen_random_uuid(), 'degen', '28 trades per week - 28 hours of DeFi browsing', 1424000, now())",
  ].join(' ');
  pgm.sql(sql);
}

function createDefaultVouchers(pgm) {
  createVoucher(pgm, {
    name: 'default sign up voucher',
    code: 'FREEPRIVACY',
    validUntil: '2025-01-01',
  });
  createVoucher(pgm, {
    name: 'eth rome voucher',
    code: 'ETHROMEHACKERS',
    validUntil: '2023-11-01',
  });
}

function createVoucher(pgm, { name, code, validUntil }) {
  const sql = [
    'insert into vouchers (id, package_id, name, code, valid_until, created_at)',
    `select gen_random_uuid(), (select id from packages where name = 'degen'), '${name}', '${code}', '${validUntil}', now()`,
    `where not exists (select id from vouchers where code = '${code}')`,
  ].join(' ');
  pgm.sql(sql);
}

function updateExistingVouchers(pgm) {
  const sql =
    "update vouchers set package_id = (select id from packages where name = 'degen');";
  pgm.sql(sql);
}
