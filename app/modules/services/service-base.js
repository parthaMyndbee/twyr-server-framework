/*
 * Name			: app/modules/services/service-base.js
 * Author		: Vish Desai (vishwakarma_d@hotmail.com)
 * Version		: 0.9.1.2
 * Copyright	: Copyright (c) 2014 - 2016 Vish Desai (https://www.linkedin.com/in/vishdesai).
 * License		: The MITNFA License (https://spdx.org/licenses/MITNFA.html).
 * Description	: The Twy'r Server Base Class for Services - providing common functionality required for all services
 *
 */

"use strict";

var base = require('./../../module-base').baseModule,
	prime = require('prime'),
	promises = require('bluebird');

/**
 * Module dependencies, required for this module
 */

var twyrServiceBase = prime({
	'inherits': base,

	'constructor': function(module) {
		base.call(this, module);

		if (this.name == 'database-service') {
			this.dependencies = [];
			return;
		}

		if (this.name == 'configuration-service') {
			this.dependencies = ['database-service'];
			return;
		}

		if (this.name == 'logger-service') {
			this.dependencies = ['configuration-service'];
			return;
		}

		if (this.dependencies.indexOf('logger-service') < 0)
			this.dependencies.unshift('logger-service');
	},

	'getInterface': function () {
		return this;
	},

	'name': 'twyr-service-base',
	'dependencies': []
});

exports.baseService = twyrServiceBase;