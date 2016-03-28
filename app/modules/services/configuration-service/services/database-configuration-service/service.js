/*
 * Name			: app/modules/services/configuration-service/services/database-configuration-service/service.js
 * Author		: Vish Desai (vishwakarma_d@hotmail.com)
 * Version		: 0.9.1.3
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
var knex = require('knex'),
	lodash = require('lodash'),
	path = require('path');

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

		self['$database'] = knexInstance;

		self.$database.migrate.latest()
		.then(function() {
			return self.$database.seed.run();
		})
		.catch(function(err) {
			console.log(self.name + '::migration Error:\n', err);
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

			self.$database.destroy()
			.then(function() {
				if(callback) callback(null, status);
				return null;
			})
			.catch(function(destroyErr) {
				if(callback) callback(destroyErr);
			})
			.finally(function() {
				delete self['$database'];
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
		if(cachedModule) {
			cachedModule.configuration = config;
			self.$database.raw('UPDATE modules SET configuration = ? WHERE id = ?;', [config, cachedModule.id])
			.then(function() {
				if(callback) callback(null, cachedModule.configuration);
			})
			.catch(function(err) {
				console.error('Error saving configuration for ' + module.name + ':\n', err);
				if(callback) callback(null, {});
			});

			return;
		}

		if(callback) callback(null, {});
	},

	'getModuleState': function(module, callback) {
		var cachedModule = self._getCachedModule(module);
		if(callback) callback(null, cachedModule['enabled']);
	},

	'setModuleState': function(module, enabled, callback) {
		var cachedModule = self._getCachedModule(module);

		self.$database.raw('UPDATE modules SET enabled = ? WHERE id = ?', [enabled, cachedModule.id])
		.then(function() {
			cachedModule['enabled'] = enabled;
			if(callback) callback(null, enabled);
		})
		.catch(function(err) {
			if(callback) callback(err);
		});
	},

	'_reloadAllConfig': function(callback) {
		var self = this;

		self.$database.raw('SELECT unnest(enum_range(NULL::module_type)) AS types')
		.then(function(result) {
			self['$moduleTypes'] = lodash.map(result.rows, function(row) {
				return row.types;
			});

			var serverModule = self;
			while(serverModule.$module) serverModule = serverModule.$module;

			return self.$database.raw('SELECT id FROM modules WHERE name = ? AND parent_id IS NULL', [serverModule.name]);
		})
		.then(function(result) {
			if(!result.rows.length) {
				return { 'rows': [] };
			}

			return self.$database.raw('SELECT A.*, B.configuration FROM fn_get_module_descendants(?) A INNER JOIN modules B ON (A.id = B.id)', [result.rows[0].id]);
		})
		.then(function(result) {
			self['$cachedConfigArray'] = result.rows;
			self['$cachedConfigTree'] = self._reorgConfigsToTree(result.rows, null);

			if(callback) callback(null, true);
			return null;
		})
		.catch(function(err) {
			if(callback) callback(err);
		});
	},

	'_getCachedModule': function(module) {
		var self = this;

		// Straight Line case....
		var possibleModules = self['$cachedConfigArray'].filter(function(cachedConfig) {
			return (cachedConfig.name == module.name);
		});

		if(!possibleModules.length) {
			return null;
		}

		if(possibleModules.length == 1) {
			return possibleModules[0];
		}

		// Get the path to the root
		var currentModule = module,
			pathSegments = [];

		do {
			pathSegments.unshift(currentModule.name);

			if(currentModule.$module) {
				var moduleType = 'component';
				if(Object.keys(currentModule.$module.$services).indexOf(currentModule.name) >= 0)
					moduleType = 'service';

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

		if(parentId) {
			this['$moduleTypes'].forEach(function(moduleType) {
				reOrgedTree[moduleType] = {};
			});
		}

		configArray.forEach(function(config) {
			if(config.parent_id != parentId)
				return;

			var configObj = {};
			configObj['configuration'] = config.configuration;
			configObj['enabled'] = config.enabled;
			delete config['enabled'];

			var configSubObj = self._reorgConfigsToTree(configArray, config.id);
			self['$moduleTypes'].forEach(function(moduleType) {
				configObj[moduleType] = configSubObj[moduleType];
			});

			if(parentId == null) {
				reOrgedTree[config.name] = configObj;
			}
			else {
				reOrgedTree[config.type][config.name] = configObj;
			}
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

	'name': 'database-configuration-service',
	'basePath': __dirname,
	'dependencies': []
});

exports.service = databaseConfigurationService;
