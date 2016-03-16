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
var uuid = require('node-uuid'),
	EventEmitter = require('events');

var twyrModuleBase = prime({
	'mixin': EventEmitter,

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

		this.$loader.loadAsync(__dirname)
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
		self['$dependencies'] = dependencies;

		this.$loader.startAsync()
		.then(function(status) {
			if(!status) throw status;

			if(self.$module)
				self.$module.emit(self.name + '-start');
			else
				self.emit(self.name + '-start');

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

	'_exists': function (path, mode, callback) {
		filesystem.access(path, mode || filesystem.F_OK, function (err) {
			if(callback) callback(null, !err);
		});
	},

	'name': 'twyr-module-base',
	'dependencies': []
});

exports.baseModule = twyrModuleBase;

