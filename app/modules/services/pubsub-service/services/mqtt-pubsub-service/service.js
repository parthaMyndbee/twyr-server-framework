/*
 * Name			: app/modules/services/pubsub-service/services/mqtt-pubsub-service/service.js
 * Author		: Vish Desai (vishwakarma_d@hotmail.com)
 * Version		: 0.9.1.3
 * Copyright	: Copyright (c) 2014 - 2016 Vish Desai (https://www.linkedin.com/in/vishdesai).
 * License		: The MITNFA License (https://spdx.org/licenses/MITNFA.html).
 * Description	: The Twy'r Server MQTT Publish/Subscribe Service
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
var mqtt = require('mqtt'),
	uuid = require('node-uuid');

var mqttPubsubService = prime({
	'inherits': base,

	'constructor': function(module) {
		base.call(this, module);
	},

	'start': function(dependencies, callback) {
		var self = this,
			rootModule = self;

		while(rootModule.$module) rootModule = rootModule.$module;
		self.$config.clientId = rootModule['name'] + '-' + rootModule['$uuid'];

		mqttPubsubService.parent.start.call(self, dependencies, function(err, status) {
			if(err) {
				if(callback) callback(err);
				return;
			}

			self['$mqttClient'] = promises.promisifyAll(mqtt.connect(null, self.$config.options));
			self.$mqttClient.on('connect', self._setPubsub.bind(self, callback, status));
			self.$mqttClient.on('error', self._pubsubError.bind(self, callback, status));

			self.$mqttClient.on('message', self._onMessage.bind(self));

			/* TEST - TO BE DELETED */
			var subscriptionId = null;
			self.subscribeAsync('#', function() {
				console.log(self.name + ' Listener: ', arguments);
			})
			.then(function(subObj) {
				subscriptionId = subObj.id;
				return self.publishAsync('test/1', 'Hello, Test/1');
			})
			.then(function(response) {
				console.log(self.name + ' Test Response: ', response);
				return self.unsubscribe(subscriptionId);
			})
			.catch(function(err) {
				console.error(self.name + ' Test Error: ', err);
			});
		});
	},

	'publish': function(channel, data, callback) {
		var publishData = data,
			self = this;

		if(typeof(data) == 'object')
			publishData = JSON.stringify(data);

		this.$mqttClient.publishAsync(channel, publishData, null)
		.then(function(response) {
			if(callback) callback(null, { 'strategy': self.name, 'status': true, 'response': response });
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
			promiseResolutions.push(self.$mqttClient.subscribeAsync(channel, null));
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
				self.$mqttClient.unsubscribe(subscriptionChannel);
			}
		}

		delete self['$subscriptionIds'][subscriptionId];
		if(callback) callback(null, true);
	},

	'stop': function(callback) {
		var self = this;
		mqttPubsubService.parent.stop.call(self, function(err, status) {
			if(err) {
				if(callback) callback(err);
				return;
			}

			self['$mqttClient'].endAsync(false)
			.then(function() {
				if(callback) callback(null, status);
				return null;
			})
			.catch(function(endErr) {
				if(callback) callback(endErr);
			});
		});
	},

	'_setPubsub': function(callback, status, connAck) {
		if(callback) callback(null, connAck);
	},

	'_pubsubError': function(callback, status, err) {
		this.dependencies['logger-service'].error('MQTT pubsub service error:\n', err);
		if(callback) callback(err, status);
	},

	'_onMessage': function(channelReceived, data, channelSubscribed) {
		var self = this;
		data = data.toString();
		console.log(self.name + '::_onMessage: ', arguments);

		if(!self['$subscribedChannels'][channelReceived])
			return;

		self['$subscribedChannels'][channelReceived].forEach(function(subObj) {
			try {
				subObj.listener(data.toString(), channelReceived, channelSubscribed);
			}
			catch(err) {
				self.dependencies['logger-service'].error('Error calling subscription listener:\nSubscribed channel: ', channelSubscribed, '\nData Channel: ', channelReceived, '\nData: ', data, '\nError: ', err);
			}
		});
	},

	'name': 'mqtt-pubsub-service',
	'basePath': __dirname,
	'dependencies': ['configuration-service', 'logger-service'],

	'$subscribedChannels': {},
	'$subscriptionIds': {}
});

exports.service = mqttPubsubService;
