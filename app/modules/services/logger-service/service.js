/*
 * Name			: app/modules/services/logger-service/service.js
 * Author		: Vish Desai (vishwakarma_d@hotmail.com)
 * Version		: 0.9.1.2
 * Copyright	: Copyright (c) 2014 - 2016 Vish Desai (https://www.linkedin.com/in/vishdesai).
 * License		: The MITNFA License (https://spdx.org/licenses/MITNFA.html).
 * Description	: The Twy'r Server Logger Service
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
	uuid = require('node-uuid');

var loggerService = prime({
	'inherits': base,

	'constructor': function(module) {
		base.call(this, module);
	},

	'start': function(dependencies, callback) {
		var self = this;

		(dependencies['configuration-service']).loadConfigAsync('logger-service')
		.then(function(loggerConfig) {
			self['$config'] = loggerConfig;

			loggerService.parent.start.call(self, dependencies, function(err, status) {
				if(err) {
					if(callback) callback(err);
					return;
				}

				self['$winston'] = require('winston');

				// Determine the root folder of the application
				var rootPath = path.dirname(require.main.filename);

				// Add transports as we go along...
				for(var transportIdx in self.$config) {
					var thisTransport = self.$config[transportIdx];

					if(thisTransport.filename) {
						var dirName = path.join(rootPath, path.dirname(thisTransport.filename)),
							baseName = path.basename(thisTransport.filename, path.extname(thisTransport.filename));

						thisTransport.filename = path.resolve(path.join(dirName, baseName + '-' + self.$module.$uuid + path.extname(thisTransport.filename)));
					}

					try {
						if(self.$winston.transports[transportIdx])
							self.$winston.remove(self.$winston.transports[transportIdx]);
					}
					catch(err) {
						// console.error('Error Removing ' + transportIdx + ' Transport from Winston: ', err.message);
					}

					try {
						if(self.$winston.transports[transportIdx]) {
							// console.log('Adding ' + transportIdx + ' Transport to the Winston instance');
							self.$winston.add(self.$winston.transports[transportIdx], thisTransport);
						}
						else {
							// TODO: Load the required Winston driver before adding it
						}
					}
					catch(err) {
						console.error('Error Adding ' + transportIdx + ' Transport to Winston: ', err.message);
					}
				}

				// Ensure the logger isn't crashing the API Server :-)
				self.$winston.exitOnError = false;
				self.$winston.emitErrs = false;

				// The first log of the day...
				self.$winston.debug('Winston Logger successfully setup, and running...');
				if(callback) callback(null, status);
			});

			return null;
		})
		.catch(function(err) {
			if(callback) callback(err);
		});
	},

	'getInterface': function() {
		return this.$winston;
	},

	'stop': function(callback) {
		var self = this;

		loggerService.parent.stop.call(self, function(err, status) {
			if(err) {
				callback(err);
				return;
			}

			// The last log of the day...
			self.$winston.debug('Goodbye, blue sky...');

			// Remove the transports so that it stops logging
			for(var transportIdx in self.$config) {
				try {
					// console.log('Removing ' + transportIdx + ' Transport from the Winston instance');
					self.$winston.remove(self.$winston.transports[transportIdx]);
				}
				catch(err) {
					// console.error('Error Removing ' + transportIdx + ' from the Winston instance: ', err.message);
				}
			}

			delete self['$winston'];
			if(callback) callback(null, status);
		});
	},

	'name': 'logger-service',
	'dependencies': ['configuration-service']
});

exports.service = loggerService;
