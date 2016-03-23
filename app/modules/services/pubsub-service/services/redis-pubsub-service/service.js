/*
 * Name			: app/modules/services/pubsub-service/services/redis-pubsub-service/service.js
 * Author		: Vish Desai (vishwakarma_d@hotmail.com)
 * Version		: 0.9.1.3
 * Copyright	: Copyright (c) 2014 - 2016 Vish Desai (https://www.linkedin.com/in/vishdesai).
 * License		: The MITNFA License (https://spdx.org/licenses/MITNFA.html).
 * Description	: The Twy'r Server Redis Publish/Subscribe Service
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
var redis = require('redis'),
	uuid = require('node-uuid');

var redisPubsubService = prime({
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

		redisPubsubService.parent.start.call(self, dependencies, function(err, status) {
			if(err) {
				if(callback) callback(err);
				return;
			}

			self['$publishServer'] = promises.promisifyAll(redis.createClient(self.$config.port, self.$config.host, self.$config.options));
			self.$publishServer.on('connect', self._setPubsub.bind(self, callback, status));
			self.$publishServer.on('error', self._pubsubError.bind(self, callback, status));

			self['$subscribeServer'] = promises.promisifyAll(redis.createClient(self.$config.port, self.$config.host, self.$config.options));
			self.$subscribeServer.on('connect', self._setPubsub.bind(self, callback, status));
			self.$subscribeServer.on('error', self._pubsubError.bind(self, callback, status));

			self.$subscribeServer.on('pmessage', self._onMessage.bind(self));
		});
	},

	'publish': function(channel, data, callback) {
		var publishData = data,
			self = this;

		if(typeof(data) == 'object')
			publishData = JSON.stringify(data);

		this.$publishServer.publishAsync(channel, publishData)
		.then(function(numSubscribers) {
			if(callback) callback(null, { 'strategy': self.name, 'status': true, 'response': numSubscribers });
		})
		.catch(function(err) {
			if(callback) callback({ 'strategy': self.name, 'status': false, 'error': err });
		});
	},

	'subscribe': function(channel, listener, callback) {
		var self = this,
			promiseResolutions = [true],
			subObj = {
				'id': uuid.v4().toString().replace(/-/g, ''),
				'listener': listener
			};

		if(!self['$subscribedChannels'][channel]) {
			self['$subscribedChannels'][channel] = [];
			promiseResolutions.push(self.$subscribeServer.psubscribeAsync(channel));
		}

		promises.all(promiseResolutions)
		.then(function() {
			self['$subscribedChannels'][channel].push(subObj);
			self['$subscriptionIds'][subObj.id] = channel;

			if(callback) callback(null, { 'subscriptionId': subObj.id });
		})
		.catch(function(err) {
			if(callback) callback(err);
		});
	},

	'unsubscribe': function(subscriptionId, callback) {
		var self = this;
		if(!self['$subscriptionIds'][subscriptionId]) {
			if(callback) callback(null, true);
			return;
		}

		var subscriptionChannel = self['$subscriptionIds'][subscriptionId],
			channelListeners = self['$subscribedChannels'][subscriptionChannel],
			delIdx = null;

		if(channelListeners) {
			channelListeners.forEach(function(subObj, idx) {
				if(subObj.id == subscriptionId)
					delIdx = idx;
			});
		}

		if(delIdx !== null) {
			channelListeners.splice(delIdx, 1);
			if(!channelListeners.length) {
				delete self['$subscribedChannels'][subscriptionChannel];
				self.$subscribeServer.punsubscribe(subscriptionChannel);
			}
		}

		delete self['$subscriptionIds'][subscriptionId];
		if(callback) callback(null, true);
	},

	'stop': function(callback) {
		var self = this;
		redisPubsubService.parent.stop.call(self, function(err, status) {
			if(err) {
				if(callback) callback(err);
				return;
			}

			var promiseResolutions = [self.$publishServer.quitAsync(), self.$subscribeServer.quitAsync()];

			promises.all(promiseResolutions)
			.then(function() {
				self.$publishServer.end(true);
				self.$subscribeServer.end(true);

				delete self['$publishServer'];
				delete self['$subscribeServer'];

				if(callback) callback(null, status);
				return null;
			})
			.catch(function(err) {
				if(callback) callback(err);
			});
		});
	},

	'_setPubsub': function(callback, status) {
		this.dependencies['logger-service'].debug(this.name + '::_setPubsub::status: ', status);
		if(callback) callback(null, status);
	},

	'_pubsubError': function(callback, status, err) {
		this.dependencies['logger-service'].error('Error connecting to the Redis pubsub server:\n', err);
		if(callback) callback(err, status);
	},

	'_onMessage': function(channelSubscribed, channelReceived, data) {
		var self = this;

		if(!self['$subscribedChannels'][channelSubscribed])
			return;

		self['$subscribedChannels'][channelSubscribed].forEach(function(subObj) {
			try {
				subObj.listener(data, channelReceived, channelSubscribed);
			}
			catch(err) {
				self.dependencies['logger-service'].error('Error calling subscription listener:\nSubscribed channel: ', channelSubscribed, '\nData Channel: ', channelReceived, '\nData: ', data, '\nError: ', err);
			}
		});
	},

	'name': 'redis-pubsub-service',
	'basePath': __dirname,
	'dependencies': ['configuration-service', 'logger-service'],

	'$subscribedChannels': {},
	'$subscriptionIds': {}
});

exports.service = redisPubsubService;
