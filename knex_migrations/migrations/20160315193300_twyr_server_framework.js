
exports.up = function(knex, Promise) {
	return Promise.all([
		knex("modules").insert({ 'name': 'twyr-server', 'display_name': 'Twyr Server', 'description': 'The Twy\'r Server Module - the "Application Class" for the Server' }).returning('id')
		.then(function(parentId) {
			parentId = parentId[0];
			return Promise.all([
				knex("modules").insert({ 'parent_id': parentId, 'type': 'service', 'name': 'logger-service', 'display_name': 'Logger Service', 'description': 'The Twy\'r Server Logger Service' }),
				knex("modules").insert({ 'parent_id': parentId, 'type': 'service', 'name': 'database-service', 'display_name': 'Database Service', 'description': 'The Twy\'r Server Database Service - built on top of Knex / Booksshelf and so supports MySQL, PostgreSQL, and a few others' }),
				knex("modules").insert({ 'parent_id': parentId, 'type': 'service', 'name': 'configuration-service', 'display_name': 'Configuration Service', 'description': 'The Twy\'r Server Configuration Service' }).returning('id')
				.then(function(configSrvcId) {
					configSrvcId = configSrvcId[0];
					return Promise.all([
						knex("modules").insert({ 'parent_id': configSrvcId, 'type': 'service', 'name': 'file-configuration-service', 'display_name': 'File Configuration Service', 'description': 'The Twy\'r Server Filesystem-based Configuration Service' }),
						knex("modules").insert({ 'parent_id': configSrvcId, 'type': 'service', 'name': 'database-configuration-service', 'display_name': 'Database Configuration Service', 'description': 'The Twy\'r Server Database-based Configuration Service' })
					]);
				})
			]);
		})
	]);
};

exports.down = function(knex, Promise) {
	return Promise.all([
		knex("modules").del()
	]);
};
