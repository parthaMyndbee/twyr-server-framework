
exports.seed = function(knex, Promise) {
	return knex.raw('SELECT id FROM modules WHERE name = ? AND parent IS NULL', ['twyr-server'])
	.then(function(serverId) {
		if(serverId.rows.length)
			return null;

		return Promise.all([
			knex("modules").insert({ 'name': 'twyr-server', 'display_name': 'Twyr Server', 'description': 'The Twy\'r Server Module - the "Application Class" for the Server' }).returning('id')
			.then(function(parentId) {
				parentId = parentId[0];
				return Promise.all([
					parentId,
					knex("modules").insert({ 'parent': parentId, 'type': 'service', 'name': 'logger-service', 'display_name': 'Logger Service', 'description': 'The Twy\'r Server Logger Service' }),
					knex("modules").insert({ 'parent': parentId, 'type': 'service', 'name': 'cache-service', 'display_name': 'Cache Service', 'description': 'The Twy\'r Server Cache Service - based on Redis' }),
					knex("modules").insert({ 'parent': parentId, 'type': 'service', 'name': 'pubsub-service', 'display_name': 'Publish/Subscribe Service', 'description': 'The Twy\'r Server Publish/Subscribe Service - based on Ascoltatori' }),
					knex("modules").insert({ 'parent': parentId, 'type': 'service', 'name': 'database-service', 'display_name': 'Database Service', 'description': 'The Twy\'r Server Database Service - built on top of Knex / Booksshelf and so supports MySQL, PostgreSQL, and a few others' }),
					knex("modules").insert({ 'parent': parentId, 'type': 'service', 'name': 'api-service', 'display_name': 'API Service', 'description': 'The Twy\'r Server API Service - allows modules to expose interfaces for use by other modules without direct references to each other' }),
					knex("modules").insert({ 'parent': parentId, 'type': 'service', 'name': 'configuration-service', 'display_name': 'Configuration Service', 'description': 'The Twy\'r Server Configuration Service' }).returning('id')
					.then(function(configSrvcId) {
						configSrvcId = configSrvcId[0];
						return Promise.all([
							knex("modules").insert({ 'parent': configSrvcId, 'type': 'service', 'name': 'file-configuration-service', 'display_name': 'File Configuration Service', 'description': 'The Twy\'r Server Filesystem-based Configuration Service' }),
							knex("modules").insert({ 'parent': configSrvcId, 'type': 'service', 'name': 'database-configuration-service', 'display_name': 'Database Configuration Service', 'description': 'The Twy\'r Server Database-based Configuration Service' })
						]);
					}),
				]);
			})
			.then(function(parentId) {
				parentId = parentId[0];

				return Promise.all([
					knex("permissions").insert({ 'module': parentId, 'name': 'public', 'display_name': 'Public User Permissions', 'description': 'The Twy\'r Server Permissions for non-logged-in Users' }),
					knex("permissions").insert({ 'module': parentId, 'name': 'registered', 'display_name': 'Registered User Permissions', 'description': 'The Twy\'r Server Permissions for logged-in Users' }),
					knex("permissions").insert({ 'module': parentId, 'name': 'administrator', 'display_name': 'Administrator Permissions', 'description': 'The Twy\'r Server Permissions for Administrators' }),
					knex("permissions").insert({ 'module': parentId, 'name': 'super-administrator', 'display_name': 'Super Administrator Permissions', 'description': 'The Twy\'r Server Permissions for Super Administrators' })
				]);
			})
		]);
	});
};
