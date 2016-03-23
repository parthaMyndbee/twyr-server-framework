
exports.up = function(knex, Promise) {
   return Promise.all([
		knex.raw('SELECT id FROM modules WHERE name = ? AND parent_id IS NULL', ['twyr-server'])
		.then(function(twyrServerId) {
			twyrServerId = twyrServerId.rows[0].id;
			return knex("modules").insert({ 'parent_id': twyrServerId, 'type': 'service', 'name': 'pubsub-service', 'display_name': 'Publish/Subscribe Service' }).returning('id')
			.then(function(pubsubSrvcId) {
				return Promise.all([
					knex("modules").insert({ 'parent_id': pubsubSrvcId[0], 'type': 'service', 'name': 'redis-pubsub-service', 'display_name': 'Publish/Subscribe Service for Redis' }),
					knex("modules").insert({ 'parent_id': pubsubSrvcId[0], 'type': 'service', 'name': 'mqtt-pubsub-service', 'display_name': 'Publish/Subscribe Service for MQTT' })
				]);
			});
		})
  ]);
};

exports.down = function(knex, Promise) {

};
