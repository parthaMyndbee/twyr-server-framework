/*
 * Name			: app/modules/services/cache-service/service.js
 * Author		: Vish Desai (vishwakarma_d@hotmail.com)
 * Version		: 0.9.1.3
 * Copyright	: Copyright (c) 2014 - 2016 Vish Desai (https://www.linkedin.com/in/vishdesai).
 * License		: The MITNFA License (https://spdx.org/licenses/MITNFA.html).
 * Description	: The Twy'r Server Cache Service
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
var path = require('path'),
	redis = require('redis');

var cacheService = prime({
	'inherits': base,

	'constructor': function(module) {
		base.call(this, module);
	},

	'start': function(dependencies, callback) {
		var self = this;
		self.$config.options['retry_strategy'] = (function (options) {
			if (options.error.code === 'ECONNREFUSED') {
				// End reconnecting on a specific error and flush all commands with a individual error
				return new Error('The server refused the connection');
			}

			if (options.total_retry_time > 1000 * 60 * 60) {
				// End reconnecting after a specific timeout and flush all commands with a individual error
				return new Error('Retry time exhausted');
			}

			if (options.times_connected > 10) {
				// End reconnecting with built in error
				return undefined;
			}

			// reconnect after
			return Math.max(options.attempt * 100, 3000);
		});

		cacheService.parent.start.call(self, dependencies, function(err, status) {
			if(err) {
				if(callback) callback(err);
				return;
			}

			self['$cache'] = promises.promisifyAll(redis.createClient(self.$config.port, self.$config.host, self.$config.options));
			self.$cache.on('connect', self._setCache.bind(self, callback, status));
			self.$cache.on('error', self._cacheError.bind(self, callback, status));
		});
	},

	'getInterface': function() {
		return this.$cache;
	},

	'stop': function(callback) {
		var self = this;
		cacheService.parent.stop.call(self, function(err, status) {
			if(err) {
				if(callback) callback(err);
				return;
			}

			self.$cache.quitAsync()
			.then(function() {
				self.$cache.end(true);
				delete self['$cache'];

				if(callback) callback(null, status);
				return null;
			})
			.catch(function(err) {
				if(callback) callback(err);
			});
		});
	},

	'_setCache': function(callback, status) {
		this.dependencies['logger-service'].debug('Connected to the cache server: ', JSON.stringify(status, null, '\t'));
		if(callback) callback(null, status);
	},

	'_cacheError': function(callback, status, err) {
		this.dependencies['logger-service'].error('Error connecting to the cache:\n', err);
		if(callback) callback(err, status);
	},

	'name': 'cache-service',
	'basePath': __dirname,
	'dependencies': ['configuration-service', 'logger-service']
});

exports.service = cacheService;
