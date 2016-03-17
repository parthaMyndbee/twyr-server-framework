/*
 * Name			: app/modules/services/configuration-service/services/file-configuration-service/service.js
 * Author		: Vish Desai (vishwakarma_d@hotmail.com)
 * Version		: 0.9.1.2
 * Copyright	: Copyright (c) 2014 - 2016 Vish Desai (https://www.linkedin.com/in/vishdesai).
 * License		: The MITNFA License (https://spdx.org/licenses/MITNFA.html).
 * Description	: The Twy'r Server File-based Configuration Service
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
var path = require('path'),
	filesystem = promises.promisifyAll(require('fs'));

var fileConfigurationService = prime({
	'inherits': base,

	'constructor': function(module) {
		base.call(this, module);
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
			}

			if(callback) callback(null, config);
			return null;
		})
		.catch(function (err) {
			console.error(module + ' Load Configuration From File Error: ', err);
			if(callback) callback(err);
		});
	},

	'saveConfig': function (module, config, callback) {
		var rootPath = path.dirname(require.main.filename),
			env = (process.env.NODE_ENV || 'development').toLowerCase(),
			configPath = path.join(rootPath, 'config', env, module + '.js');

		var configString = 'exports.config = (' + JSON.stringify(config, null, '\t') + ');';
		filesystem.writeFileAsync(configPath, configString)
		.then(function () {
			if(callback) callback(null, config);
		})
		.catch(function(err) {
			console.error(module + ' Save Configuration to File Error: ', err);
			if(callback) callback(err);
		});
	},

	'name': 'file-configuration-service',
	'basePath': __dirname,
	'dependencies': []
});

exports.service = fileConfigurationService;
