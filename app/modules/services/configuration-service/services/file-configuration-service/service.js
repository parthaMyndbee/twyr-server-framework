/*
 * Name			: app/modules/services/configuration-service/services/file-configuration-service/service.js
 * Author		: Vish Desai (vishwakarma_d@hotmail.com)
 * Version		: 0.9.1.3
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
var chokidar = require('chokidar'),
	path = require('path'),
	filesystem = promises.promisifyAll(require('fs-extra'));

var fileConfigurationService = prime({
	'inherits': base,

	'constructor': function(module) {
		base.call(this, module);
	},

	'start': function(dependencies, callback) {
		var self = this,
			rootPath = path.dirname(require.main.filename),
			env = (process.env.NODE_ENV || 'development').toLowerCase();

		self['$watcher'] = chokidar.watch(path.join(rootPath, 'config', env), {
			'ignored': /[\/\\]\./,
			'ignoreInitial': true
		});

		self['$watcher']
			.on('add', self._onNewConfiguration.bind(self))
			.on('change', self._onUpdateConfiguration.bind(self))
			.on('unlink', self._onDeleteConfiguration.bind(self));

		fileConfigurationService.parent.start.call(self, dependencies, function(err, status) {
			if(err) {
				if(callback) callback(err);
				return;
			}

			if(callback) callback(null, true);
		});
	},

	'stop': function(callback) {
		var self = this;
		self['$watcher'].close();

		// Stop sub-services, if any...
		fileConfigurationService.parent.stop.call(self, function(err, status) {
			if(err) {
				if(callback) callback(err);
				return;
			}

			if(callback) callback(null, status);
		});
	},

	'loadConfig': function(module, callback) {
		var rootPath = path.dirname(require.main.filename),
			env = (process.env.NODE_ENV || 'development').toLowerCase(),
			configPath = path.join(rootPath, 'config', env, path.relative(rootPath, module.basePath).replace('app/modules', '') + '.js'),
			self = this;

		filesystem.ensureDirAsync(path.dirname(configPath))
		.then(function() {
			return self._existsAsync(configPath, filesystem.R_OK);
		})
		.then(function (doesExist) {
			var config = {};

			if (doesExist) {
				config = require(configPath).config;
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
			configPath = path.join(rootPath, 'config', env, path.relative(rootPath, module.basePath).replace('app/modules', '') + '.js'),
			configString = 'exports.config = (' + JSON.stringify(config, null, '\t') + ');';

		filesystem.ensureDirAsync(path.dirname(configPath))
		.then(function() {
			return filesystem.writeFileAsync(configPath, configString);
		})
		.then(function () {
			if(callback) callback(null, config);
			return null;
		})
		.catch(function(err) {
			console.error(module + ' Save Configuration to File Error: ', err);
			if(callback) callback(err);
		});
	},

	'getModuleState': function(module, callback) {
		if(callback) callback(null, true);
	},

	'setModuleState': function(module, enabled, callback) {
		if(callback) callback(null, enabled);
	},

	'_onNewConfiguration': function(filePath) {
		var self = this,
			rootPath = path.dirname(require.main.filename),
			env = (process.env.NODE_ENV || 'development').toLowerCase(),
			module = path.relative(rootPath, filePath).replace('config/' + env, '').replace('.js', '');

		delete require.cache[filePath];
		self.$module.emit('new-config', self.name, module, require(filePath).config);
	},

	'_onUpdateConfiguration': function(filePath) {
		var self = this,
			rootPath = path.dirname(require.main.filename),
			env = (process.env.NODE_ENV || 'development').toLowerCase(),
			module = path.relative(rootPath, filePath).replace('config/' + env, '').replace('.js', '');

		delete require.cache[filePath];
		self.$module.emit('update-config', self.name, module, require(filePath).config);
	},

	'_onDeleteConfiguration': function(filePath) {
		var self = this,
			rootPath = path.dirname(require.main.filename),
			env = (process.env.NODE_ENV || 'development').toLowerCase(),
			module = path.relative(rootPath, filePath).replace('config/' + env, '').replace('.js', '');

		delete require.cache[filePath];
		self.$module.emit('delete-config', self.name, module);
	},

	'_processConfigChange': function(configUpdateModule, config) {
		console.log(this.name + '::_processConfigChange:\nModule: ' + configUpdateModule + '\nConfig: ' + JSON.stringify(config, null, '\t'));
	},

	'name': 'file-configuration-service',
	'basePath': __dirname,
	'dependencies': []
});

exports.service = fileConfigurationService;
