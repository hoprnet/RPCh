/* eslint-disable camelcase */

exports.up = (pgm) => {
    pgm.addColumn('registered_nodes', {
        exit_app_target: { type: 'varchar(255)' },
    });
    pgm.renameColumn('registered_nodes', 'exit_node_pub_key', 'exit_app_pub_key');
};

exports.down = (pgm) => {
    pgm.renameColumn('registered_nodes', 'exit_app_pub_key', 'exit_node_pub_key');
    pgm.dropColumns('registered_nodes', ['exit_app_target']);
};
