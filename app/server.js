/*
 * Name			: app/server.js
 * Author		: Vish Desai (vishwakarma_d@hotmail.com)
 * Version		: 0.9.1.2
 * Copyright	: Copyright (c) 2014 - 2016 Vish Desai (https://www.linkedin.com/in/vishdesai).
 * License		: The MITNFA License (https://spdx.org/licenses/MITNFA.html).
 * Description	: The Twy'r Server Module - the "Application Class" for the Server
 *
 */

"use strict";

/**
 * Module dependencies, required for ALL Twy'r modules
 */
var base = require('./module-base').baseModule,
	prime = require('prime'),
	promises = require('bluebird');

/**
 * Module dependencies, required for this module
 */
var path = require('path');

var app = prime({
	'inherits': base,

	'constructor': function (module) {
		base.call(this, module);
		this._loadConfig();
	},

	'start': function(dependencies, callback) {
		var self = this;

		app.parent.start.call(self, dependencies, function(err, status) {
			if(err) {
				if(callback) callback(err);
				return;
			}

			callback(null, status);
		});
	},

	'_loadConfig': function() {
		var rootPath = path.dirname(require.main.filename),
			env = (process.env.NODE_ENV || 'development').toLowerCase();

		this['$config'] = require(path.join(rootPath, 'config', env, this.name)).config;
	},

	'name': 'twyr-server',
	'dependencies': []
});

exports.twyrServer = app;
