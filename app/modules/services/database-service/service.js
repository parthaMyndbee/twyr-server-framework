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

		dependencies['configuration-service'].loadConfigAsync(self)
		.then(function(databaseConfig) {
			var rootPath = path.dirname(require.main.filename);
			databaseConfig.migrations.directory = path.join(rootPath, databaseConfig.migrations.directory);
			databaseConfig.seeds.directory = path.join(rootPath, databaseConfig.seeds.directory);
			self['$config'] = databaseConfig;

			var knexInstance = knex(self.$config);
			knexInstance.on('query', self._databaseQuery.bind(self));
			knexInstance.on('query-error', self._databaseQueryError.bind(self));

			self['$database'] = bookshelf(knexInstance);

			// Start sub-services, if any...
			databaseService.parent.start.call(self, dependencies, function(err, status) {
				if(err) {
					if(callback) callback(err);
					return;
				}

				if(callback) callback(null, status);
			});

			return null;
		})
		.catch(function(err) {
			dependencies['logger-service'].error(self.name + '::start Error:\n', err);
			if(callback) callback(err);
		})
		.then(function() {
			return self.$database.knex.migrate.latest();
		})
		.then(function() {
			return self.$database.knex.seed.run();
		})
		.catch(function(err) {
			dependencies['logger-service'].info(self.name + '::migration Error:\n', err);
		});
	},

	'getInterface': function() {
		return this.$database;
	},

	'stop': function(callback) {
		var self = this;

		// Stop sub-services, if any...
		databaseService.parent.stop.call(self, function(err, status) {
			if(err) {
				if(callback) callback(err);
				return;
			}

			self.$database.knex.destroy()
			.then(function() {
				if(callback) callback(null, status);
				return null;
			})
			.catch(function(destroyErr) {
				if(callback) callback(destroyErr);
			})
			.finally(function() {
				delete self['$database'];
			});
		});
	},

	'_databaseQuery': function(queryData) {
		this.dependencies['logger-service'].silly(this.name + '::_databaseQuery: ', queryData);
	},

	'_databaseQueryError': function(err, queryData) {
		this.dependencies['logger-service'].error(this.name + '::_databaseQueryError: ', { 'query': queryData, 'error': err });
	},

	'_databaseNotice': function() {
		this.dependencies['logger-service'].info(this.name + '::_databaseNotice: ', arguments);
	},

	'_databaseError': function() {
		this.dependencies['logger-service'].error(this.name + '::_databaseError: ', arguments);
	},

	'name': 'database-service',
	'basePath': __dirname,
	'dependencies': ['configuration-service', 'logger-service']
});

exports.service = databaseService;
