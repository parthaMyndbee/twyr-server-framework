/*
 * Name			: config/production/database-service.js
 * Author		: Vish Desai (vishwakarma_d@hotmail.com)
 * Version		: 0.9.1.2
 * Copyright	: Copyright (c) 2014 - 2016 Vish Desai (https://www.linkedin.com/in/vishdesai).
 * License		: The MITNFA License (https://spdx.org/licenses/MITNFA.html).
 * Description	: The Twy'r Server Database Service Config
 *
 */

"use strict";

exports.config = ({
	'client': 'pg',
	'debug': true,

	'connection': {
		'host': '127.0.0.1',
		'port': '5432',
		'user': 'postgres',
		'password': 'postgres',
		'database': 'twyr'
	},

	'pool': {
		'min': 2,
		'max': 4
	}
});
