/* eslint-disable camelcase */

exports.up = (pgm) => {
    pgm.createTable('webhook_logs', {
        id: 'id',
        event_type: {
            type: 'varchar(255)',
            notNull: true,
            comment: 'Type of the event, e.g., Subscription.Created',
        },
        event_data: {
            type: 'jsonb',
            notNull: true,
            comment: 'Payload of the webhook event',
        },
        created_at: 'createdAt',
    });
};
