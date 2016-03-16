/*
 * Name			: app/modules/services/configuration-service/service.js
 * Author		: Vish Desai (vishwakarma_d@hotmail.com)
 * Version		: 0.9.1.2
 * Copyright	: Copyright (c) 2014 - 2016 Vish Desai (https://www.linkedin.com/in/vishdesai).
 * License		: The MITNFA License (https://spdx.org/licenses/MITNFA.html).
 * Description	: The Twy'r Server Configuration Service
 *
 */

"use strict";

/**
 * Module dependencies, required for ALL Twy'r modules
 */
var base = require('./../service-base').baseService,
	prime = require('prime'),
	promises = require('bluebird');

/**
 * Module dependencies, required for this module
 */
var filesystem = require('fs'),
	path = require('path');

var configurationService = prime({
	'inherits': base,

	'constructor': function(module) {
		base.call(this, module);

		Object.defineProperty(this, '$currentConfig', {
			'__proto__': null,
			'configurable': true,
			'writable': true,
			'value': {}
		});

		this._loadConfigFromFileAsync = promises.promisify(this._loadConfigFromFile.bind(this));
		this._saveConfigToFileAsync = promises.promisify(this._saveConfigToFile.bind(this));
	},

	'start': function(dependencies, callback) {
		var self = this;

		configurationService.parent.start.call(self, dependencies, function(err, status) {
			if(err) {
				if(callback) callback(err);
				return;
			}

			self.$module.on(self.$module.name + '-start', self._onServerStart.bind(self));
			if(callback) callback(null, status);
		});
	},

	'loadConfig': function(module, callback) {
		if(this['$currentConfig'][module]) {
			if(callback) callback(null, this['$currentConfig'][module]);
			return;
		}

		// TODO: Load from the database, as well?
		var self = this;

		self._loadConfigFromFileAsync(module)
		.then(function(loadedConfig) {
			self['$currentConfig'][module] = loadedConfig;
			if(callback) callback(null, loadedConfig);

			return null;
		})
		.catch(function(err) {
			if(callback) callback(err);
		});
	},

	'saveConfig': function (module, config, callback) {
		var self = this;

		// TODO: Save to the database, as well?
		this._saveConfigToFileAsync(module, config)
		.then(function(savedConfig) {
			self['$currentConfig'][module] = savedConfig;
			if(callback) callback(null, savedConfig);

			return null;
		})
		.catch(function(err) {
			if(callback) callback(err);
		});
	},

	'_onServerStart': function() {
		var self = this;

		Object.defineProperty(self, '$logger', {
			'__proto__': null,
			'configurable': true,
			'enumerable': true,
			'get': (self.$module.$services['logger-service'].getInterface.bind(self.$module.$services['logger-service']))
		});

		Object.defineProperty(self, '$database', {
			'__proto__': null,
			'configurable': true,
			'enumerable': true,
			'get': (self.$module.$services['database-service'].getInterface.bind(self.$module.$services['database-service']))
		});

		console.log(self.name + ' acquired logger-service: ', this.$logger);
		console.log(self.name + ' acquired database-service: ', this.$database);
	},

	'_loadConfigFromFile': function(module, callback) {
		var rootPath = path.dirname(require.main.filename),
			env = (process.env.NODE_ENV || 'development').toLowerCase(),
			self = this;

		self._existsAsync(path.join(rootPath, 'config', env, module + '.js'), filesystem.R_OK)
		.then(function (doesExist) {
			var config = {};

			if (doesExist) {
				config = require(path.join(rootPath, 'config', env, module)).config;
			}

			if(callback) callback(null, config);
			return null;
		})
		.catch(function (err) {
			self.$logger.error(module + ' Load Configuration From File Error: ', err);
			if(callback) callback(err);
		});
	},

	'_saveConfigToFile': function (module, config, callback) {
		var rootPath = path.dirname(require.main.filename),
			env = (process.env.NODE_ENV || 'development').toLowerCase(),
			configPath = path.join(rootPath, 'config', env, module + '.js'),
			self = this;

		var configString = 'exports.config = (' + JSON.stringify(config, null, '\t') + ');';
		filesystem.writeFile(configPath, configString, function (err) {
			if (err) {
				self.$logger.error(module + ' Save Configuration to File Error: ', err);
				if(callback) callback(err);
				return;
			}

			if(callback) callback(null, config);
		});
	},

	'name': 'configuration-service',
	'dependencies': [],

	'$logger': console
});

exports.service = configurationService;
