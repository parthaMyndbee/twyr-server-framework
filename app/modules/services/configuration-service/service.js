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
var _ = require('lodash'),
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

	'loadConfig': function(module, callback) {
		if(this['$currentConfig'][module]) {
			if(callback) callback(null, this['$currentConfig'][module]);
			return;
		}

		var self = this,
			promiseResolutions = [];

		Object.keys(self.$services).forEach(function(subService) {
			promiseResolutions.push(self.$services[subService].loadConfigAsync(module));
		});

		promises.all(promiseResolutions)
		.then(function(loadedConfigs) {
			self['$currentConfig'][module] = _.merge({}, loadedConfigs)[0];
			if(callback) callback(null, self['$currentConfig'][module]);

			console.log(module + ' merged configuration: ', self['$currentConfig'][module]);
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
			promiseResolutions.push(self.$services[subService].saveConfigAsync(module));
		});

		promises.all(promiseResolutions)
		.then(function(savedConfigs) {
			self['$currentConfig'][module] = _.merge({}, savedConfigs)[0];
			if(callback) callback(null, self['$currentConfig'][module]);

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
