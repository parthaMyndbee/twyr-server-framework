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
var path = require('path'),
	redis = require('redis');

var pubsubService = prime({
	'inherits': base,

	'constructor': function(module) {
		base.call(this, module);
	},

	'publish': function(channel, data, callback) {
		var validatedChannel = this._validateChannel(channel);

		if(validatedChannel.status) {
			if(callback) callback(new TypeError(validatedChannel.status));
			return;
		}

		if(validatedChannel.unknownStrategies.length) {
			if(callback) callback(new ReferenceError('Unknown Strategies: ' + JSON.stringify(validatedChannel.unknownStrategies)));
			return;
		}

		var promiseResolutions = [],
			self = this;

		validatedChannel.knownStrategies.forEach(function(knownStrategy) {
			promiseResolutions.push(self.$services[knownStrategy].publishAsync(validatedChannel.queue, data));
		});

		promises.all(promiseResolutions)
		.then(function(publishStatuses) {
			var returnStatus = {};

			validatedChannel.knownStrategies.forEach(function(strategy, index) {
				returnStatus[strategy] = publishStatuses[index];
			});

			if(callback) callback(null, returnStatus);
			return null;
		})
		.catch(function(err) {
			self.dependencies['logger-service'].error('Channel: ', channel, '\nData: ', data, '\nError: ', err);
			if(callback) callback(err);
		});
	},

	'subscribe': function(channel, listener, callback) {
		var validatedChannel = this._validateChannel(channel);

		if(validatedChannel.status) {
			if(callback) callback(new TypeError(validatedChannel.status));
			return;
		}

		if(validatedChannel.unknownStrategies.length) {
			if(callback) callback(new ReferenceError('Unknown Strategies: ' + JSON.stringify(validatedChannel.unknownStrategies)));
			return;
		}

		var promiseResolutions = [],
			self = this;

		validatedChannel.knownStrategies.forEach(function(knownStrategy) {
			promiseResolutions.push(self.$services[knownStrategy].subscribeAsync(validatedChannel.queue, listener));
		});

		promises.all(promiseResolutions)
		.then(function(publishStatuses) {
			var returnStatus = {};

			validatedChannel.knownStrategies.forEach(function(strategy, index) {
				returnStatus[strategy] = publishStatuses[index];
			});

			if(callback) callback(null, returnStatus);
			return null;
		})
		.catch(function(err) {
			self.dependencies['logger-service'].error('Channel: ', channel, '\nData: ', data, '\nError: ', err);
			if(callback) callback(err);
		});
	},

	'unsubscribe': function(subscriptionId, callback) {
		var promiseResolutions = [],
			self = this;

		Object.keys(self.$services).forEach(function(subService) {
			promiseResolutions.push(self.$services[subService].unsubscribeAsync(subscriptionId));
		});

		promises.all(promiseResolutions)
		.then(function() {
			if(callback) callback(null, true);
		})
		.catch(function(err) {
			if(callback) callback(err);
		});
	},

	'_validateChannel': function(channel) {
		var self = this,
			validatedChannel = {
				'status': null,
				'queue': '',
				'knownStrategies': [],
				'unknownStrategies': []
			};

		switch(typeof(channel)) {
		case 'string':
			validatedChannel.queue = channel;
			validatedChannel.knownStrategies = [].concat(Object.keys(self.$services));
			break;

		case 'object':
			if(!(channel.strategy && channel.queue)) {
				validatedChannel.status = 'Invalid Channel Format';
				return validatedChannel;
			}

			if((typeof(channel.strategy) !== 'string') && (!Array.isArray(channel.strategy))) {
				validatedChannel.status = 'Invalid Channel Format';
				return validatedChannel;
			}

			validatedChannel.queue = channel.queue;
			validatedChannel.knownStrategies = Array.isArray(channel.strategy) ? channel.strategy : [channel.strategy];

			validatedChannel.knownStrategies = validatedChannel.knownStrategies.filter(function(knownStrategy) {
				if((knownStrategy == '*') || (!!self.$services[knownStrategy])) return true;

				validatedChannel.unknownStrategies.push(knownStrategy);
				return false;
			});

			if(validatedChannel.knownStrategies.indexOf('*') >= 0)
				validatedChannel.knownStrategies = Object.keys(self.$services);

			return validatedChannel;
			break;

		default:
			validatedChannel.status = 'Invalid Channel Type';
			return validatedChannel;
		}
	},

	'name': 'pubsub-service',
	'basePath': __dirname,
	'dependencies': ['configuration-service', 'logger-service']
});

exports.service = pubsubService;
