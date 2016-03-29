/*
 * Name			: app/modules/services/configuration-service/service.js
 * Author		: Vish Desai (vishwakarma_d@hotmail.com)
 * Version		: 0.9.1.3
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
var deepmerge = require('deepmerge'),
	path = require('path'),
	filesystem = promises.promisifyAll(require('fs'));

var configurationService = prime({
	'inherits': base,

	'constructor': function(module) {
		var ConfigurationLoader = require('./configuration-loader').loader,
			configLoader = promises.promisifyAll(new ConfigurationLoader(this), {
				'filter': function(name, func) {
					return true;
				}
			});

		base.call(this, module, configLoader);
	},

	'load': function(configSrvc, callback) {
		var self = this,
			rootPath = path.dirname(require.main.filename),
			env = (process.env.NODE_ENV || 'development').toLowerCase(),
			configPath = path.join(rootPath, 'config', env, path.relative(rootPath, self.basePath).replace('app/modules', '') + '.js');

		self['$config'] = require(configPath).config;
		configurationService.parent.load.call(self, configSrvc, function(err, status) {
			if(err) {
				if(callback) callback(err);
				return;
			}

			if(!self.$prioritizedSubServices) {
				self.$prioritizedSubServices = [].concat(Object.keys(self.$services));
				self.$prioritizedSubServices.sort(function(left, right) {
					return ((self.$config.priorities[left] || 100) - (self.$config.priorities[right] || 100));
				});
			}

			if(callback) callback(null, status);
		});
	},

	'loadConfig': function(module, callback) {
		var self = this,
			promiseResolutions = [];

		self.$prioritizedSubServices.forEach(function(subService) {
			promiseResolutions.push(self.$services[subService].loadConfigAsync(module));
		});

		promises.all(promiseResolutions)
		.then(function(loadedConfigs) {
			var mergedConfig = {};

			loadedConfigs.forEach(function(loadedConfig) {
				if(!loadedConfig) return;
				mergedConfig = deepmerge(mergedConfig, loadedConfig);
			});

			return self.saveConfigAsync(module, mergedConfig);
		})
		.then(function(mergedConfig) {
			return promises.all([mergedConfig, self.getModuleStateAsync(module)]);
		})
		.then(function(result) {
			var mergedConfig = result[0],
				enabled = result[1];

//			module['$enabled'] = enabled;
			if(callback) callback(null, { 'configuration': mergedConfig, 'state': enabled });
			return null;
		})
		.catch(function(err) {
			if(callback) callback(err);
		});
	},

	'saveConfig': function (module, config, callback) {
		var self = this,
			promiseResolutions = [];

		Object.keys(self.$services).forEach(function(subService) {
			promiseResolutions.push(self.$services[subService].saveConfigAsync(module, config));
		});

		promises.all(promiseResolutions)
		.then(function(savedConfigs) {
			if(callback) callback(null, config);
			return null;
		})
		.catch(function(err) {
			if(callback) callback(err);
		});
	},

	'getModuleState': function(module, callback) {
		var self = this,
			promiseResolutions = [];

		Object.keys(self.$services).forEach(function(subService) {
			promiseResolutions.push(self.$services[subService].getModuleStateAsync(module));
		});

		promises.all(promiseResolutions)
		.then(function(moduleStates) {
			var moduleState = true;
			moduleStates.forEach(function(state) {
				moduleState = (moduleState && state);
			});

			if(callback) callback(null, moduleState);
			return null;
		})
		.catch(function(err) {
			if(callback) callback(err);
		});
	},

	'setModuleState': function(module, enabled, callback) {
		var self = this,
			promiseResolutions = [];

		Object.keys(self.$services).forEach(function(subService) {
			promiseResolutions.push(self.$services[subService].setModuleStateAsync(module, enabled));
		});

		promises.all(promiseResolutions)
		.then(function(moduleStates) {
			var moduleState = true;
			moduleStates.forEach(function(state) {
				moduleState = (moduleState && state);
			});

			if(callback) callback(null, moduleState);
			return null;
		})
		.catch(function(err) {
			if(callback) callback(err);
		});
	},

	'name': 'configuration-service',
	'basePath': __dirname,
	'dependencies': []
});

exports.service = configurationService;
