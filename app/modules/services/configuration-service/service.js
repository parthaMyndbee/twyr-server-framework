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
			'configurable': true,
			'writable': true
		});
	},

	'start': function(dependencies, callback) {
		var self = this;

		configurationService.parent.start.call(self, dependencies, function(err, status) {
			if(err) {
				if(callback) callback(err);
				return;
			}

			self.$module.on(self.$module.name + '-start', self._onStart.bind(self));
			if(callback) callback(null, status);
		});
	},

	'loadConfig': function(module, callback) {
		var rootPath = path.dirname(require.main.filename),
			env = (process.env.NODE_ENV || 'development').toLowerCase(),
			self = this;

		self._existsAsync(path.join(rootPath, 'config', env, module + '.js'), filesystem.R_OK)
		.then(function (doesExist) {
			var config = {};

			if (doesExist) {
				config = require(path.join(rootPath, 'config', env, module)).config;
				self['$currentConfig'][module] = config;
			}

			if(callback) callback(null, config);
			return null;
		})
		.catch(function (err) {
			console.error(module + ' Load Configuration Error: ', err);
			if(callback) callback(err);
		});
	},

	'saveConfig': function (module, config, callback) {
		var rootPath = path.dirname(require.main.filename),
			env = (process.env.NODE_ENV || 'development').toLowerCase(),
			configPath = path.join(rootPath, 'config', env, module + '.js'),
			self = this;

		var configString = 'exports.config = (' + JSON.stringify(config, null, '\t') + ');';
		filesystem.writeFile(configPath, configString, function (err) {
			if (err) {
				if(callback) callback(err);
				return;
			}

			self['$currentConfig'][module] = config;
			if(callback) callback(null, config);
		});
	},

	'_onStart': function() {
		Object.defineProperty(this.$dependencies, 'database-service', {
			'__proto__': null,
			'configurable': true,
			'enumerable': true,
			'get': (this.$module.$services['database-service'].getInterface.bind(this.$module.$services['database-service']))
		});
	},

	'name': 'configuration-service',
	'dependencies': ['database-service']
});

exports.service = configurationService;

