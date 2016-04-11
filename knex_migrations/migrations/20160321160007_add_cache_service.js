
exports.up = function(knex, Promise) {
	return Promise.all([
		knex.raw('SELECT id FROM modules WHERE name = ? AND parent_id IS NULL', ['twyr-server'])
		.then(function(twyrServerId) {
			twyrServerId = twyrServerId.rows[0].id;
			return knex("modules").insert({ 'parent_id': twyrServerId, 'type': 'service', 'name': 'cache-service', 'display_name': 'Cache Service', 'description': 'The Twy\'r Server Cache Service - based on Redis' });
		})
	]);
};

exports.down = function(knex, Promise) {
	return Promise.all([]);
};
