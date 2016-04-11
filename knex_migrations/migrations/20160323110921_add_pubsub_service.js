
exports.up = function(knex, Promise) {
	return Promise.all([
		knex.raw('SELECT id FROM modules WHERE name = ? AND parent_id IS NULL', ['twyr-server'])
		.then(function(twyrServerId) {
			return knex("modules").insert({ 'parent_id': twyrServerId.rows[0].id, 'type': 'service', 'name': 'pubsub-service', 'display_name': 'Publish/Subscribe Service', 'description': 'The Twy\'r Server Publish/Subscribe Service - based on Ascoltatori' });
		})
	]);
};

exports.down = function(knex, Promise) {
	return Promise.all([]);
};
