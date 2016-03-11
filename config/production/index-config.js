/*
 * Name			: config/production/index-config.js
 * Author		: Vish Desai (vishwakarma_d@hotmail.com)
 * Version		: 0.9.1.2
 * Copyright	: Copyright (c) 2014 - 2016 Vish Desai (https://www.linkedin.com/in/vishdesai).
 * License		: The MITNFA License (https://spdx.org/licenses/MITNFA.html).
 * Description	: The Twy'r Server cluster-level configuration parameters
 *
 */

"use strict";

exports.config = ({
	'loadFactor': 1.0,
	'restart': true,

	'repl': {
		'controlPort': 1137,
		'controlHost': '127.0.0.1',
		'parameters': {
			'prompt': 'Twy\'r Server >',
			'terminal': true,
			'useGlobal': false,

			'input': null,
			'output': null
		}
	},

	'main' : './app/server'
});
