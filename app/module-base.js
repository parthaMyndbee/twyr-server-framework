/*
 * Name			: app/module-base.js
 * Author		: Vish Desai (vishwakarma_d@hotmail.com)
 * Version		: 0.9.1
 * Copyright	: Copyright (c) 2014 - 2016 Vish Desai (https://www.linkedin.com/in/vishdesai).
 * License		: The MITNFA License (https://spdx.org/licenses/MITNFA.html).
 * Description	: The Twy'r Server Base Module - serving as a template for all other modules, including the main server
 *
 */

"use strict";

/**
 * Module dependencies, required for ALL Twy'r modules
 */
var prime = require('prime'),
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
	},

	'load': function(callback) {
		console.log('\nTwy\'r Module Base Load');

		this.$loader.loadAsync(__dirname)
		.then(function(status) {
			if(!status) throw status;
			if(callback) callback(null, status);

			return null;
		})
		.catch(function(err) {
			console.error('Twy\'r Module Base Load Error: ', err);
			if(callback) callback(err);
		});
	},

	'initialize': function(callback) {
		console.log('\nTwy\'r Module Base Initialize');

		this.$loader.initializeAsync()
		.then(function(status) {
			if(!status) throw status;
			if(callback) callback(null, status);

			return null;
		})
		.catch(function(err) {
			console.error('Twy\'r Module Base Initialize Error: ', err);
			if(callback) callback(err);
		});
	},

	'start': function(dependencies, callback) {
		console.log('\nTwy\'r Module Base Start');

		this.$loader.startAsync(dependencies)
		.then(function(status) {
			if(!status) throw status;
			if(callback) callback(null, status);

			return null;
		})
		.catch(function(err) {
			console.error('Twy\'r Module Base Start Error: ', err);
			if(callback) callback(err);
		});
	},

	'stop': function(callback) {
		console.log('\nTwy\'r Module Base Stop');

		this.$loader.stopAsync()
		.then(function(status) {
			if(!status) throw status;
			if(callback) callback(null, status);

			return null;
		})
		.catch(function(err) {
			console.error('Twy\'r Module Base Stop Error: ', err);
			if(callback) callback(err);
		});
	},

	'uninitialize': function(callback) {
		console.log('\nTwy\'r Module Base Uninitialize');

		this.$loader.uninitializeAsync()
		.then(function(status) {
			if(!status) throw status;
			if(callback) callback(null, status);

			return null;
		})
		.catch(function(err) {
			console.error('Twy\'r Module Base Uninitialize Error: ', err);
			if(callback) callback(err);
		});
	},

	'unload': function(callback) {
		console.log('\nTwy\'r Module Base Unload');

		var self = this;
		this.$loader.unloadAsync()
		.then(function(status) {
			if(!status) throw status;
			if(callback) callback(null, status);

			return null;
		})
		.catch(function(err) {
			console.error('Twy\'r Module Base Unload Error: ', err);
			if(callback) callback(err);
		})
		.finally(function() {
			delete self['$loader'];
			delete self['$module'];

			return null;
		});
	},

	'_loadConfig': function() {
		// Load / Store the configuration...
		var env = (process.env.NODE_ENV || 'development').toLowerCase(),
			config = require(path.join(__dirname, 'config', env, 'server-config')).config;

		this['$config'] = config;
	},

	'name': 'twyr-module-base',
	'dependencies': []
});

exports.baseModule = twyrModuleBase;

