/*
 * Name			: config/production/logger-service.js
 * Author		: Vish Desai (vishwakarma_d@hotmail.com)
 * Version		: 0.9.1.2
 * Copyright	: Copyright (c) 2014 - 2016 Vish Desai (https://www.linkedin.com/in/vishdesai).
 * License		: The MITNFA License (https://spdx.org/licenses/MITNFA.html).
 * Description	: The Twy'r Server Logger Service Config
 *
 */

"use strict";

exports.config = ({
	'Console': {
		'level': 'info',
		'colorize': true,
		'timestamp': true,

		'json': true,
		'prettyPrint': true,

		'humanReadableUnhandledException': true
	},

	'File': {
		'level': 'debug',
		'colorize': true,
		'timestamp': true,

		'json': true,
		'prettyPrint': true,

		'filename': 'logs/twyr-server.log',
		'maxsize': 10485760,
		'maxFiles': 5,

		'tailable': true,
		'zippedArchive': true
	}
});
