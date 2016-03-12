/*
 * Name			: app/modules/services/database-service/service.js
 * Author		: Vish Desai (vishwakarma_d@hotmail.com)
 * Version		: 0.9.1.2
 * Copyright	: Copyright (c) 2014 - 2016 Vish Desai (https://www.linkedin.com/in/vishdesai).
 * License		: The MITNFA License (https://spdx.org/licenses/MITNFA.html).
 * Description	: The Twy'r Server Database Service
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
var bookshelf = require('bookshelf'),
	knex = require('knex'),
	path = require('path');

var databaseService = prime({
	'inherits': base,

	'constructor': function(module) {
		base.call(this, module);
	},

	'start': function(dependencies, callback) {
		var self = this;
		databaseService.parent.start.call(self, dependencies, function(err, status) {
			if(err) {
				callback(err);
				return;
			}

			self['$database'] = bookshelf(knex(self.$config));
			self.$database.knex.client.on('notice', self._databaseNotice.bind(self));
			self.$database.knex.client.on('error', self._databaseError.bind(self));

			callback(null, status);
		});
	},

	'getInterface': function() {
		return this.$database;
	},

	'stop': function(callback) {
		var self = this;
		databaseService.parent.stop.call(self, function(err, status) {
			if(err) {
				callback(err);
				return;
			}

			self.$database.knex.destroy()
			.then(function() {
				if(callback) callback(null, status);
				return null;
			})
			.catch(function(err) {
				if(callback) callback(err);
			})
			.finally(function() {
				delete self['$database'];
			});
		});
	},

	'_databaseNotice': function(msg) {
		console.log('database-service Notice: ', msg);
	},

	'_databaseError': function(err) {
		console.error('database-service Error:\n', err);
	},

	'name': 'database-service',
	'dependencies': []
});

exports.service = databaseService;

