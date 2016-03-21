
exports.up = function(knex, Promise) {
	return Promise.all([
		knex("modules").insert({ 'name': 'twyr-server', 'display_name': 'Twyr Server' }).returning('id')
		.then(function(parentId) {
			parentId = parentId[0];
			return Promise.all([
				knex("modules").insert({ 'parent_id': parentId, 'type': 'service', 'name': 'logger-service', 'display_name': 'Logger Service' }),
				knex("modules").insert({ 'parent_id': parentId, 'type': 'service', 'name': 'database-service', 'display_name': 'Database Service' }),
				knex("modules").insert({ 'parent_id': parentId, 'type': 'service', 'name': 'configuration-service', 'display_name': 'Configuration Service' }).returning('id')
				.then(function(configSrvcId) {
					configSrvcId = configSrvcId[0];
					return Promise.all([
						knex("modules").insert({ 'parent_id': configSrvcId, 'type': 'service', 'name': 'file-configuration-service', 'display_name': 'File Configuration Service' }),
						knex("modules").insert({ 'parent_id': configSrvcId, 'type': 'service', 'name': 'database-configuration-service', 'display_name': 'Database Configuration Service' })
					]);
				})
			]);
		})
	]);
};

exports.down = function(knex, Promise) {
	return Promise.all([
	]);
};
