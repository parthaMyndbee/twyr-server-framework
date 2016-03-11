/*
 * Name			: server.js
 * Author		: Vish Desai (vishwakarma_d@hotmail.com)
 * Version		: 0.9.1
 * Copyright	: Copyright (c) 2014 - 2016 Vish Desai (https://www.linkedin.com/in/vishdesai).
 * License		: The MITNFA License (https://spdx.org/licenses/MITNFA.html).
 * Description	: The Twy'r Server "Application Class"
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

var app = prime({
	'constructor': function() {
		this['$uuid'] = uuid.v4().toString().replace(/-/g, '');
	},

	'load': function(module, loader, callback) {
		console.log('\nTwyr Server Load');

		this['$module'] = module;
		this['$loader'] = loader;

		this.$loader.loadAsync()
		.then(function(status) {
			if(!status) throw status;
			if(callback) callback(null, status);

			return null;
		})
		.catch(function(err) {
			console.error('Twyr Server Load Error: ', err);
			if(callback) callback(err);
		});
	},

	'initialize': function(callback) {
		console.log('\nTwyr Server Initialize');

		this.$loader.initializeAsync()
		.then(function(status) {
			if(!status) throw status;
			if(callback) callback(null, status);

			return null;
		})
		.catch(function(err) {
			console.error('Twyr Server Initialize Error: ', err);
			if(callback) callback(err);
		});
	},

	'start': function(dependencies, callback) {
		console.log('\nTwyr Server Start');

		this.$loader.startAsync(dependencies)
		.then(function(status) {
			if(!status) throw status;
			if(callback) callback(null, status);

			return null;
		})
		.catch(function(err) {
			console.error('Twyr Server Start Error: ', err);
			if(callback) callback(err);
		});
	},

	'stop': function(callback) {
		console.log('\nTwyr Server Stop');

		this.$loader.stopAsync()
		.then(function(status) {
			if(!status) throw status;
			if(callback) callback(null, status);

			return null;
		})
		.catch(function(err) {
			console.error('Twyr Server Stop Error: ', err);
			if(callback) callback(err);
		});
	},

	'uninitialize': function(callback) {
		console.log('\nTwyr Server Uninitialize');

		this.$loader.uninitializeAsync()
		.then(function(status) {
			if(!status) throw status;
			if(callback) callback(null, status);

			return null;
		})
		.catch(function(err) {
			console.error('Twyr Server Uninitialize Error: ', err);
			if(callback) callback(err);
		});
	},

	'unload': function(callback) {
		console.log('\nTwyr Server Unload');

		var self = this;
		this.$loader.unloadAsync()
		.then(function(status) {
			if(!status) throw status;
			if(callback) callback(null, status);

			return null;
		})
		.catch(function(err) {
			console.error('Twyr Server Unload Error: ', err);
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

	'name': 'Twyr Server',
	'dependencies': []
});

exports.twyrServer = app;

