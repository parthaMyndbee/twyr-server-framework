
exports.up = function(knex, Promise) {
	return Promise.all([
		knex.raw('SELECT id FROM modules WHERE name = ? AND parent_id IS NULL', ['twyr-server'])
		.then(function(twyrServerId) {
			return knex("modules").insert({ 'parent_id': twyrServerId.rows[0].id, 'type': 'service', 'name': 'api-service', 'display_name': 'API Service', 'description': 'The Twy\'r Server API Service - allows modules to expose interfaces for use by other modules without direct references to each other' });
		})
	]);
};

exports.down = function(knex, Promise) {
	return Promise.all([]);
};
