/*
 * Name			: app/modules/services/pubsub-service/service.js
 * Author		: Vish Desai (vishwakarma_d@hotmail.com)
 * Version		: 0.9.1.3
 * Copyright	: Copyright (c) 2014 - 2016 Vish Desai (https://www.linkedin.com/in/vishdesai).
 * License		: The MITNFA License (https://spdx.org/licenses/MITNFA.html).
 * Description	: The Twy'r Server Umbrella Publish/Subscribe Service
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
var ascoltatori = promises.promisifyAll(require('ascoltatori'));

var pubsubService = prime({
	'inherits': base,

	'constructor': function(module) {
		base.call(this, module);
	},

	'start': function(dependencies, callback) {
		var self = this,
			promiseResolutions = [];

		Object.keys(self.$config).forEach(function(pubsubStrategy) {
			var buildSettings = self.$config[pubsubStrategy];
			buildSettings[pubsubStrategy] = require(buildSettings[pubsubStrategy]);
			promiseResolutions.push(ascoltatori.buildAsync(buildSettings));
		});

		promises.all(promiseResolutions)
		.then(function(listeners) {
			Object.defineProperty(self, '$listeners', {
				'__proto__': null,
				'value': {}
			});

			Object.keys(self.$config).forEach(function(pubsubStrategy, index) {
				self['$listeners'][pubsubStrategy] = promises.promisifyAll(listeners[index]);
			});

			pubsubService.parent.start.call(self, dependencies, function(err, status) {
				if(err) {
					if(callback) callback(err);
					return;
				}

				if(callback) callback(null, status);
			});

			return null;
		});
	},

	'publish': function(strategy, topic, data, options, callback) {
		var self = this,
			promiseResolutions = [];

		if(!Array.isArray(strategy))
			strategy = [strategy];

		Object.keys(self.$listeners).forEach(function(pubsubStrategy) {
			if((strategy.indexOf('*') < 0) && (strategy.indexOf(pubsubStrategy) < 0)) return;
			promiseResolutions.push((self['$listeners'][pubsubStrategy]).publishAsync(topic, data, options));
		});

		promises.all(promiseResolutions)
		.then(function() {
			if(callback) callback(null, true);
		})
		.catch(function(err) {
			if(callback) callback(err);
		});
	},

	'subscribe': function(strategy, topic, listener, callback) {
		var self = this,
			promiseResolutions = [];

		if(!Array.isArray(strategy))
			strategy = [strategy];

		Object.keys(self.$listeners).forEach(function(pubsubStrategy) {
			if((strategy.indexOf('*') < 0) && (strategy.indexOf(pubsubStrategy) < 0)) return;
			promiseResolutions.push((self['$listeners'][pubsubStrategy]).subscribeAsync(topic, listener));
		});

		promises.all(promiseResolutions)
		.then(function() {
			if(callback) callback(null, true);
		})
		.catch(function(err) {
			if(callback) callback(err);
		});
	},

	'unsubscribe': function(topic, listener, callback) {
		var self = this,
			promiseResolutions = [];

		Object.keys(self.$listeners).forEach(function(pubsubStrategy) {
			promiseResolutions.push((self['$listeners'][pubsubStrategy]).unsubscribeAsync(topic, listener));
		});

		promises.all(promiseResolutions)
		.then(function() {
			if(callback) callback(null, true);
		})
		.catch(function(err) {
			if(callback) callback(err);
		});
	},

	'stop': function(callback) {
		var self = this;

		pubsubService.parent.stop.call(self, function(err, status) {
			if(err) {
				if(callback) callback(err);
				return;
			}

			var promiseResolutions = [];
			Object.keys(self.$listeners).forEach(function(pubsubStrategy) {
				promiseResolutions.push((self['$listeners'][pubsubStrategy]).closeAsync());
			});

			promises.all(promiseResolutions)
			.then(function() {
				if(callback) callback(null, status);
			})
			.catch(function(teardownErr) {
				if(callback) callback(teardownErr);
			});
		});
	},

	'name': 'pubsub-service',
	'basePath': __dirname,
	'dependencies': ['configuration-service', 'logger-service']
});

exports.service = pubsubService;
