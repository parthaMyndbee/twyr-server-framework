/*
 * Name			: config/production/twyr-server.js
 * Author		: Vish Desai (vishwakarma_d@hotmail.com)
 * Version		: 0.9.2
 * Copyright	: Copyright (c) 2014 - 2016 Vish Desai (https://www.linkedin.com/in/vishdesai).
 * License		: The MITNFA License (https://spdx.org/licenses/MITNFA.html).
 * Description	: The Twy'r Server application-level configuration parameters
 *
 */

"use strict";

exports.config = ({
	'utilities': {
		'path': './modules/utilities'
	},

	'services': {
		'path': './modules/services'
	},

	'components': {
		'path': './modules/components'
	}
});
