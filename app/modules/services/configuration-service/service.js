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
		base.call(this, module);

		this.$config = ({
			'services': {
				'path': './services'
			}
		});

		Object.defineProperty(this, '$currentConfig', {
			'__proto__': null,
			'configurable': true,
			'writable': true,
			'value': {}
		});
	},

	'load': function(callback) {
		var self = this;

		configurationService.parent.load.call(self, function(err, status) {
			if(err) {
				if(callback) callback(err);
				return;
			}

			self.loadConfigAsync(self)
			.then(function(config) {
				self.$config = deepmerge(self.$config, config);

				if(!self.$prioritizedSubServices) {
					self.$prioritizedSubServices = [].concat(Object.keys(self.$services));
					self.$prioritizedSubServices.sort(function(left, right) {
						return ((self.$config.priorities[left] || 100) - (self.$config.priorities[right] || 100));
					});
				}

				var configModified = false;
				Object.keys(self.$services).forEach(function(subService) {
					if(self.$config.priorities[subService]) return;

					configModified = true;
					self.$config.priorities[subService] = 100;
				});

				if(!configModified)
					return null;

				return self.saveConfigAsync(self, self.$config);
			})
			.then(function() {
				if(callback) callback(null, status);
				return null;
			})
			.catch(function(err) {
				if(callback) callback(err);
			});
		});
	},

	'loadConfig': function(module, callback) {
		if(this['$currentConfig'][module.name]) {
			if(callback) callback(null, this['$currentConfig'][module.name]);
			return;
		}

		var self = this,
			promiseResolutions = [];

		if(self.$prioritizedSubServices) {
			self.$prioritizedSubServices.forEach(function(subService) {
				promiseResolutions.push(self.$services[subService].loadConfigAsync(module));
			});
		}
		else {
			Object.keys(self.$services).forEach(function(subService) {
				promiseResolutions.push(self.$services[subService].loadConfigAsync(module));
			});
		}

		promises.all(promiseResolutions)
		.then(function(loadedConfigs) {
			self['$currentConfig'][module.name] = {};
			loadedConfigs.forEach(function(loadedConfig) {
				self['$currentConfig'][module.name] = deepmerge(self['$currentConfig'][module.name], loadedConfig);
			});

			return self.saveConfigAsync(module, self['$currentConfig'][module.name]);
		})
		.then(function() {
			if(callback) callback(null, self['$currentConfig'][module.name]);
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
			self['$currentConfig'][module.name] = config;
			if(callback) callback(null, self['$currentConfig'][module.name]);

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
