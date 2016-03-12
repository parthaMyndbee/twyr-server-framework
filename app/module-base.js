/*
 * Name			: app/module-base.js
 * Author		: Vish Desai (vishwakarma_d@hotmail.com)
 * Version		: 0.9.1.2
 * Copyright	: Copyright (c) 2014 - 2016 Vish Desai (https://www.linkedin.com/in/vishdesai).
 * License		: The MITNFA License (https://spdx.org/licenses/MITNFA.html).
 * Description	: The Twy'r Server Base Module - serving as a template for all other modules, including the main server
 *
 */

"use strict";

/**
 * Module dependencies, required for ALL Twy'r modules
 */
var filesystem = require('fs'),
	path = require('path'),
	prime = require('prime'),
	promises = require('bluebird');

/**
 * Module dependencies, required for this module
 */
var uuid = require('node-uuid');

var twyrModuleBase = prime({
	'constructor': function(module) {
		this['$module'] = module;
		this['$uuid'] = uuid.v4().toString().replace(/-/g, '');

		var TwyrLoader = require('./loader').loader;
		this['$loader'] = promises.promisifyAll(new TwyrLoader(this), {
			'filter': function(name, func) {
				return true;
			}
		});

		this._existsAsync = promises.promisify(this._exists);
	},

	'load': function(callback) {
		// console.log(this.name + ' Load');
		var self = this;

		this.loadConfigAsync()
		.then(function() {
			return self.$loader.loadAsync(__dirname);
		})
		.then(function(status) {
			if(!status) throw status;
			if(callback) callback(null, status);

			return null;
		})
		.catch(function(err) {
			console.error(self.name + ' Load Error: ', err);
			if(callback) callback(err);
		});
	},

	'initialize': function(callback) {
		// console.log(this.name + ' Initialize');
		var self = this;

		this.$loader.initializeAsync()
		.then(function(status) {
			if(!status) throw status;
			if(callback) callback(null, status);

			return null;
		})
		.catch(function(err) {
			console.error(self.name + ' Initialize Error: ', err);
			if(callback) callback(err);
		});
	},

	'start': function(dependencies, callback) {
		// console.log(this.name + ' Start');
		var self = this;

		this.$loader.startAsync(dependencies)
		.then(function(status) {
			if(!status) throw status;
			if(callback) callback(null, status);

			return null;
		})
		.catch(function(err) {
			console.error(self.name + ' Start Error: ', err);
			if(callback) callback(err);
		});
	},

	'stop': function(callback) {
		// console.log(this.name + ' Stop');
		var self = this;

		this.$loader.stopAsync()
		.then(function(status) {
			if(!status) throw status;
			if(callback) callback(null, status);

			return null;
		})
		.catch(function(err) {
			console.error(self.name + ' Stop Error: ', err);
			if(callback) callback(err);
		});
	},

	'uninitialize': function(callback) {
		// console.log(this.name + ' Uninitialize');
		var self = this;

		this.$loader.uninitializeAsync()
		.then(function(status) {
			if(!status) throw status;
			if(callback) callback(null, status);

			return null;
		})
		.catch(function(err) {
			console.error(self.name + ' Uninitialize Error: ', err);
			if(callback) callback(err);
		});
	},

	'unload': function(callback) {
		// console.log(this.name + ' Unload');
		var self = this;

		this.$loader.unloadAsync()
		.then(function(status) {
			if(!status) throw status;
			if(callback) callback(null, status);

			return null;
		})
		.catch(function(err) {
			console.error(self.name + ' Unload Error: ', err);
			if(callback) callback(err);
		})
		.finally(function() {
			delete self['$loader'];
			delete self['$module'];

			return null;
		});
	},

	'loadConfig': function(callback) {
		var rootPath = path.dirname(require.main.filename),
			env = (process.env.NODE_ENV || 'development').toLowerCase(),
			self = this;

		self._existsAsync(path.join(rootPath, 'config', env, self.name + '.js'))
		.then(function (doesExist) {
			var config = {};

			if (doesExist) {
				config = require(path.join(rootPath, 'config', env, self.name)).config;
				self['$config'] = config;
			}

			if(callback) callback(null, config);
			return null;
		})
		.catch(function (err) {
			console.error(self.name + ' Load Configuration Error: ', err);
			if(callback) callback(err);
		});
	},

	'saveConfig': function (config, callback) {
		var rootPath = path.dirname(require.main.filename),
			env = (process.env.NODE_ENV || 'development').toLowerCase(),
			configPath = path.join(rootPath, 'config', env, this.name + '.js'),
			self = this;

		var configString = 'exports.config = (' + JSON.stringify(config, null, '\t') + ');';
		filesystem.writeFile(configPath, configString, function (err) {
			if (err) {
				if(callback) callback(err);
				return;
			}

			self['$config'] = config;
			if(callback) callback(null, config);
		});
	},

	'_exists': function (path, callback) {
		filesystem.exists(path, function (doesExist) {
			if(callback) callback(null, doesExist);
		});
	},

	'name': 'twyr-module-base',
	'dependencies': []
});

exports.baseModule = twyrModuleBase;

