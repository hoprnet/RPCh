/* eslint-disable camelcase */

exports.up = (pgm) => {
    // billing scheme
    // this will get more data once the ingegration with the payment provider becomes more clear
    // it basically describes something like 10$ per month or 100$ per year (cost over time)
    pgm.createTable('billing_schemes', {
        id: 'id',
        name: { type: 'varchar(255)', notNull: true },
        desc: { type: 'varchar(255)' },
        created_at: 'createdAt',
        updated_at: 'timestamp',
    });

    // packages
    // those are the different packages that users can book
    pgm.createTable('packages', {
        id: 'id',
        name: { type: 'varchar(255)', notNull: true },
        desc: { type: 'varchar(255)' },
        billing_scheme_id: {
            type: 'uuid',
            references: 'billing_schemes',
            notNull: true,
        },
        alternative_billing_scheme_id: {
            type: 'uuid',
            references: 'billing_schemes',
        },
        created_at: 'createdAt',
        updated_at: 'timestamp',
    });

    pgm.createIndex('packages', 'billing_scheme_id');
    pgm.createIndex('packages', 'alternative_billing_scheme_id');

    // quota bundles
    // these describe capabilites (e.g. amount of segments) that can be used
    pgm.createTable('quota_bundles', {
        id: 'id',
        segment_count: { type: 'integer' },
        rpc_method_count: { type: 'integer' },
        rpc_method: { type: 'varchar(255)' },
        created_at: 'createdAt',
        updated_at: 'timestamp',
    });

    // vouchers
    // describe marketing promotion codes that can be redeemed
    pgm.createTable('vouchers', {
        id: 'id',
        name: { type: 'varchar(255)' },
        code: { type: 'varchar(255)', notNull: true },
        valid_until: { type: 'timestamp' },
        uses_left: { type: 'integer' },
        created_at: 'createdAt',
        updated_at: 'timestamp',
    });

    pgm.createIndex('vouchers', 'code', { unique: true });

    ////
    // relations

    // user can have multiple packages associated
    pgm.createTable('users_packages', {
        user_id: { type: 'uuid', references: 'users', notNull: true },
        package_id: { type: 'uuid', references: 'packages', notNull: true },
        created_at: 'createdAt',
        invalidated_at: { type: 'timestamp' },
    });

    pgm.createIndex('users_packages', 'user_id');
    pgm.createIndex('users_packages', 'package_id');

    // packages provide quota bundles
    pgm.createTable('packages_quota_bundles', {
        package_id: { type: 'uuid', references: 'packages', notNull: true },
        quota_bundle_id: {
            type: 'uuid',
            references: 'quota_bundles',
            notNull: true,
        },
        valid_from: { type: 'timestamp' },
        valid_until: { type: 'timestamp' },
    });

    pgm.createIndex('packages_quota_bundles', ['package_id', 'quota_bundle_id'], {
        unique: true,
    });
    pgm.createIndex('packages_quota_bundles', 'package_id');
    pgm.createIndex('packages_quota_bundles', 'quota_bundle_id');

    // vouchers provide quota bundles
    pgm.createTable('vouchers_quota_bundles', {
        voucher_id: { type: 'uuid', references: 'vouchers', notNull: true },
        quota_bundle_id: {
            type: 'uuid',
            references: 'quota_bundles',
            notNull: true,
        },
    });

    pgm.createIndex('vouchers_quota_bundles', ['voucher_id', 'quota_bundle_id'], {
        unique: true,
    });
    pgm.createIndex('vouchers_quota_bundles', 'voucher_id');
    pgm.createIndex('vouchers_quota_bundles', 'quota_bundle_id');

    // redeemed vouchers are associated to users
    pgm.createTable('redeemed_vouchers', {
        user_id: { type: 'uuid', references: 'users', notNull: true },
        voucher_id: { type: 'uuid', references: 'vouchers', notNull: true },
        createdAt: 'createdAt',
    });

    pgm.createIndex('redeemed_vouchers', ['user_id', 'voucher_id'], {
        unique: true,
    });
    pgm.createIndex('redeemed_vouchers', 'user_id');
    pgm.createIndex('redeemed_vouchers', 'voucher_id');
};
