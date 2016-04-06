/*
 * Name			: app/modules/services/configuration-service/services/database-configuration-service/service.js
 * Author		: Vish Desai (vishwakarma_d@hotmail.com)
 * Version		: 0.9.1.4
 * Copyright	: Copyright (c) 2014 - 2016 Vish Desai (https://www.linkedin.com/in/vishdesai).
 * License		: The MITNFA License (https://spdx.org/licenses/MITNFA.html).
 * Description	: The Twy'r Server Database-based Configuration Service
 *
 */

"use strict";

/**
 * Module dependencies, required for ALL Twy'r modules
 */
var base = require('./../../../service-base').baseService,
	prime = require('prime'),
	promises = require('bluebird');

/**
 * Module dependencies, required for this module
 */
var inflection = require('inflection'),
	knex = require('knex'),
	lodash = require('lodash'),
	path = require('path'),
	pg = require('pg');

var databaseConfigurationService = prime({
	'inherits': base,

	'constructor': function(module) {
		base.call(this, module);

		this._reloadAllConfigAsync = promises.promisify(this._reloadAllConfig);
	},

	'start': function(dependencies, callback) {
		var self = this;

		if(!self.$module.$config.subservices) {
			if(callback) callback(null, false);
			return;
		}

		if(!self.$module.$config.subservices.database) {
			if(callback) callback(null, false);
			return;
		}

		var rootPath = path.dirname(require.main.filename);
		self['$config'] = self.$module.$config.subservices.database;
		self['$config'].migrations.directory = path.join(rootPath, self['$config'].migrations.directory);
		self['$config'].seeds.directory = path.join(rootPath, self['$config'].seeds.directory);

		var knexInstance = knex(self['$config']);
		knexInstance.on('query', self._databaseQuery.bind(self));
		knexInstance.on('query-error', self._databaseQueryError.bind(self));

		knexInstance.migrate.latest()
		.then(function() {
			return knexInstance.seed.run();
		})
		.catch(function(err) {
			console.log(self.name + '::migration Error:\n', err);
		})
		.then(function() {
			return knexInstance.destroy();
		})
		.then(function() {
			self['$database'] = promises.promisifyAll(new pg.Client(self.$config.connection));
			return self['$database'].connectAsync();
		})
		.then(function() {
			self['$database'].on('notice', self._databaseNotice.bind(self));
			self['$database'].on('notification', self._databaseNotification.bind(self));

			return self['$database'].queryAsync('LISTEN "config-change"');
		})
		.then(function() {
			return self._reloadAllConfigAsync();
		})
		.then(function() {
			databaseConfigurationService.parent.start.call(self, dependencies, function(err, status) {
				if(err) {
					if(callback) callback(err);
					return;
				}

				if(callback) callback(null, true);
			});
		})
		.catch(function(err) {
			if(callback) callback(err);
		});
	},

	'stop': function(callback) {
		var self = this;

		// Stop sub-services, if any...
		databaseConfigurationService.parent.stop.call(self, function(err, status) {
			if(err) {
				if(callback) callback(err);
				return;
			}

			self['$database'].queryAsync('UNLISTEN "config-change"')
			.then(function() {
				self.$database.end();
				delete self['$database'];

				if(callback) callback(null, status);
			})
			.catch(function(unlistenErr) {
				if(callback) callback(unlistenErr);
			});
		});
	},

	'loadConfig': function(module, callback) {
		var self = this;

		if(!this['$database']) {
			if(callback) callback(null, {});
			return;
		}

		var cachedModule = self._getCachedModule(module);
		if(cachedModule) {
			if(callback) callback(null, cachedModule['configuration']);
			return;
		}

		if(callback) callback(null, {});
	},

	'saveConfig': function (module, config, callback) {
		var self = this;

		if(!this['$database']) {
			if(callback) callback(null, {});
			return;
		}

		var cachedModule = self._getCachedModule(module);
		if(!cachedModule) {
			if(callback) callback(null, {});
			return;
		}

		if(JSON.stringify(cachedModule.configuration, null, '\t') == JSON.stringify(config, null, '\t')) {
			if(callback) callback(null, cachedModule.configuration);
			return;
		}

		cachedModule.configuration = config;
		self.$database.queryAsync('UPDATE modules SET configuration = $1 WHERE id = $2;', [config, cachedModule.id])
		.then(function() {
			if(callback) callback(null, cachedModule.configuration);
		})
		.catch(function(err) {
			console.error('Error saving configuration for ' + module.name + ':\n', err);
			if(callback) callback(null, {});
		});
	},

	'getModuleState': function(module, callback) {
		var self = this,
			cachedModule = self._getCachedModule(module);

		if(!cachedModule) {
			if(callback) callback(null, true);
			return;
		}

		if(callback) callback(null, cachedModule['enabled']);
	},

	'setModuleState': function(module, enabled, callback) {
		var self = this,
			cachedModule = self._getCachedModule(module);

		if(!cachedModule) {
			if(callback) callback(null, true);
			return;
		}

		if(cachedModule.enabled == enabled) {
			if(callback) callback(null, enabled);
			return;
		}

		cachedModule['enabled'] = enabled;
		self.$database.queryAsync('UPDATE modules SET enabled = $1 WHERE id = $2', [enabled, cachedModule.id])
		.then(function() {
			if(callback) callback(null, enabled);
		})
		.catch(function(err) {
			if(callback) callback(err);
		});
	},

	'_processConfigChange': function(configUpdateModule, config) {
		var currentModule = this;
		while(currentModule.$module)
			currentModule = currentModule.$module;

		var pathSegments = path.join(currentModule.name, configUpdateModule).split(path.sep);

		// Iterate down the cached config objects
		var cachedModule = this['$cachedConfigTree'][pathSegments.shift()];
		pathSegments.forEach(function(segment) {
			if(!cachedModule) return;
			cachedModule = cachedModule[segment];
		});

		if(!cachedModule)
			return;

		if(JSON.stringify(cachedModule.configuration, null, '\t') == JSON.stringify(config, null, '\t')) {
			return;
		}

		cachedModule.configuration = config;
		this.$database.queryAsync('UPDATE modules SET configuration = $1 WHERE id = $2;', [config, cachedModule.id])
		.catch(function(err) {
			console.error('Error saving configuration for ' + cachedModule.name + ':\n', err);
		});
	},

	'_processStateChange': function(configUpdateModule, state) {
		var currentModule = this;
		while(currentModule.$module)
			currentModule = currentModule.$module;

		var pathSegments = path.join(currentModule.name, configUpdateModule).split(path.sep);

		// Iterate down the cached config objects
		var cachedModule = this['$cachedConfigTree'][pathSegments.shift()];
		pathSegments.forEach(function(segment) {
			if(!cachedModule) return;
			cachedModule = cachedModule[segment];
		});

		if(!cachedModule)
			return;

		if(cachedModule.enabled == state) {
			return;
		}

		cachedModule.enabled = state;
		this.$database.queryAsync('UPDATE modules SET enabled = $1 WHERE id = $2;', [state, cachedModule.id])
		.catch(function(err) {
			console.error('Error saving state for ' + cachedModule.name + ':\n', err);
		});
	},

	'_reloadAllConfig': function(callback) {
		var self = this;

		self.$database.queryAsync('SELECT unnest(enum_range(NULL::module_type)) AS type')
		.then(function(result) {
			self['$moduleTypes'] = lodash.map(result.rows, function(row) {
				return inflection.pluralize(row.type);
			});

			var serverModule = self;
			while(serverModule.$module) serverModule = serverModule.$module;

			return self.$database.queryAsync('SELECT id FROM modules WHERE name = $1 AND parent_id IS NULL', [serverModule.name]);
		})
		.then(function(result) {
			if(!result.rows.length) {
				return { 'rows': [] };
			}

			return self.$database.queryAsync('SELECT A.*, B.configuration FROM fn_get_module_descendants($1) A INNER JOIN modules B ON (A.id = B.id)', [result.rows[0].id]);
		})
		.then(function(result) {
			self['$cachedConfigTree'] = self._reorgConfigsToTree(result.rows, null);
			if(callback) callback(null, true);
			return null;
		})
		.catch(function(err) {
			if(callback) callback(err);
		});
	},

	'_getCachedModule': function(module) {
		var self = this,
			currentModule = module,
			pathSegments = [];

		do {
			pathSegments.unshift(currentModule.name);

			if(currentModule.$module) {
				var moduleType = '';
				self['$moduleTypes'].forEach(function(type) {
					if(Object.keys(currentModule.$module['$' + type]).indexOf(currentModule.name) >= 0)
						moduleType = type;
				});

				pathSegments.unshift(moduleType);
			}

			currentModule = currentModule.$module;
		} while(currentModule);

		// Iterate down the cached config objects
		var cachedModule = self['$cachedConfigTree'][pathSegments.shift()];
		pathSegments.forEach(function(segment) {
			if(!cachedModule) return;
			cachedModule = cachedModule[segment];
		});

		return cachedModule;
	},

	'_reorgConfigsToTree': function(configArray, parentId) {
		var reOrgedTree = {},
			self = this;

		if(!self['$cachedMap']) {
			self['$cachedMap'] = {};
		}

		if(parentId) {
			this['$moduleTypes'].forEach(function(moduleType) {
				reOrgedTree[moduleType] = {};
			});
		}

		configArray.forEach(function(config) {
			if(config.parent_id != parentId)
				return;

			var configObj = {};
			configObj['id'] = config.id;
			configObj['name'] = config.name;
			configObj['enabled'] = config.enabled;
			configObj['configuration'] = config.configuration;

			var configSubObj = self._reorgConfigsToTree(configArray, config.id);
			self['$moduleTypes'].forEach(function(moduleType) {
				configObj[moduleType] = configSubObj[moduleType];
			});

			if(parentId == null) {
				reOrgedTree[config.name] = configObj;
			}
			else {
				reOrgedTree[inflection.pluralize(config.type)][config.name] = configObj;
			}

			self['$cachedMap'][(configObj['id'])] = configObj;
		});

		return reOrgedTree;
	},

	'_getModulePath': function(module, callback) {
		if(callback) callback(null, '');
	},

	'_databaseQuery': function(queryData) {
		// console.log(this.name + '::_databaseQuery: ', queryData);
	},

	'_databaseQueryError': function(err, queryData) {
		console.error(this.name + '::_databaseQueryError: ', { 'query': queryData, 'error': err });
	},

	'_databaseNotification': function(data) {
		var self = this,
			emitConfigChangeEvent = false,
			emitStateChangeEvent = false;

		self.$database.queryAsync('SELECT enabled, configuration FROM modules WHERE id = $1', [data.payload])
		.then(function(result) {
			if(!result.rows.length)
				return;

			var newConfiguration = JSON.stringify(result.rows[0].configuration, null, '\t'),
				newEnabled = result.rows[0].enabled,
				oldConfiguration = JSON.stringify(self['$cachedMap'][data.payload]['configuration'], null, '\t'),
				oldEnabled = self['$cachedMap'][data.payload]['enabled'];

			if(oldEnabled != newEnabled) {
				self['$cachedMap'][data.payload]['enabled'] = newEnabled;
				emitStateChangeEvent = true;
			}

			if(oldConfiguration != newConfiguration) {
				self['$cachedMap'][data.payload]['configuration'] = result.rows[0].configuration;
				emitConfigChangeEvent = true;
			}

			if(!(emitConfigChangeEvent || emitStateChangeEvent))
				return null;

			return self.$database.queryAsync('SELECT name, type FROM fn_get_module_ancestors($1) ORDER BY level DESC', [data.payload]);
		})
		.then(function(result) {
			if(!result) return null;
			result = result.rows;

			result.shift();
			if(!result.length) return null;

			var module = [];
			result.forEach(function(pathSegment) {
				module.push(inflection.pluralize(pathSegment.type));
				module.push(pathSegment.name);
			});

			if(emitConfigChangeEvent) {
				self.$module.emit('update-config', self.name, module.join('/'), self['$cachedMap'][data.payload]['configuration']);
			}

			if(emitStateChangeEvent) {
				self.$module.emit('update-state', self.name, module.join('/'), self['$cachedMap'][data.payload]['enabled']);
			}

			return null;
		})
		.catch(function(err) {
			console.error('Error retrieving configuration for ' + data.payload + ':\n', err);
		});
	},

	'_databaseNotice': function() {
		console.log(this.name + '::_databaseNotification: ', JSON.stringify(arguments, null, '\t'));
	},

	'name': 'database-configuration-service',
	'basePath': __dirname,
	'dependencies': []
});

exports.service = databaseConfigurationService;
