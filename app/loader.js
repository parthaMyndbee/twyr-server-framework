/*
 * Name			: app/loader.js
 * Author		: Vish Desai (vishwakarma_d@hotmail.com)
 * Version		: 0.9.1.2
 * Copyright	: Copyright (c) 2014 - 2016 Vish Desai (https://www.linkedin.com/in/vishdesai).
 * License		: The MITNFA License (https://spdx.org/licenses/MITNFA.html).
 * Description	: The Twy'r Server dependency manager and service/component loader
 *
 */

"use strict";

/**
 * Module dependencies, required for ALL Twy'r modules
 */
var prime = require('prime'),
	promises = require('bluebird');

/**
 * Module dependencies, required for this module
 */
var dependencyGraph = require('dependency-graph').DepGraph,
	filesystem = require('fs'),
	path = require('path');

var twyrLoader = prime({
	'constructor': function(module) {
		// Sanity Check: The module itself must be valid...
		if(!module.name || !module.dependencies) {
			return;
		}

		if(!module.load || !module.initialize || !module.start || !module.stop || !module.uninitialize || !module.unload){
			return;
		}

		Object.defineProperty(this, '$module', {
			'__proto__': null,
			'value': module
		});
	},

	'load': function(basePath, callback) {
		var promiseResolutions = [],
			self = this;

		Object.defineProperty(this, '$basePath', {
			'__proto__': null,
			'value': path.resolve(basePath)
		});

		promiseResolutions.push(self._loadUtilitiesAsync());
		promiseResolutions.push(self._loadServicesAsync());
		promiseResolutions.push(self._loadComponentsAsync());

		promises.all(promiseResolutions)
		.then(function(status) {
			if(!status) throw status;
			if(callback) callback(null, self._filterStatus(status));

			return null;
		})
		.catch(function(err) {
			if(callback) callback(err);
		});
	},

	'initialize': function(callback) {
		var promiseResolutions = [],
			self = this;

		promiseResolutions.push(self._initializeServicesAsync());
		promiseResolutions.push(self._initializeComponentsAsync());

		promises.all(promiseResolutions)
		.then(function(status) {
			if(!status) throw status;
			if(callback) callback(null, self._filterStatus(status));

			return null;
		})
		.catch(function(err) {
			if(callback) callback(err);
		});
	},

	'start': function(callback) {
		var self = this,
			finalStatus = [];

		self._startServicesAsync()
		.then(function(status) {
			if(!status) throw status;
			finalStatus.push(status);

			return self._startComponentsAsync();
		})
		.then(function(status) {
			if(!status) throw status;
			finalStatus.push(status);

			if(callback) callback(null, self._filterStatus(finalStatus));
			return null;
		})
		.catch(function(err) {
			if(callback) callback(err);
		});
	},

	'stop': function(callback) {
		var self = this,
			finalStatus = [];

		self._stopComponentsAsync()
		.then(function(status) {
			if(!status) throw status;
			finalStatus.push(status);

			return self._stopServicesAsync();
		})
		.then(function(status) {
			if(!status) throw status;
			finalStatus.push(status);

			if(callback) callback(null, self._filterStatus(finalStatus));
			return null;
		})
		.catch(function(err) {
			if(callback) callback(err, false);
		});
	},

	'uninitialize': function(callback) {
		var promiseResolutions = [],
			self = this;

		promiseResolutions.push(self._uninitializeComponentsAsync());
		promiseResolutions.push(self._uninitializeServicesAsync());

		promises.all(promiseResolutions)
		.then(function(status) {
			if(!status) throw status;

			if(callback) callback(null, self._filterStatus(status));
			return null;
		})
		.catch(function(err) {
			if(callback) callback(err, false);
		});
	},

	'unload': function(callback) {
		var promiseResolutions = [],
			self = this;

		promiseResolutions.push(self._unloadComponentsAsync());
		promiseResolutions.push(self._unloadServicesAsync());
		promiseResolutions.push(self._unloadUtilitiesAsync());

		promises.all(promiseResolutions)
		.then(function(status) {
			if(!status) throw status;

			if(callback) callback(null, self._filterStatus(status));
			return null;
		})
		.catch(function(err) {
			if(callback) callback(err, false);
		});
	},

	'_loadUtilities': function(callback) {
		try {
			if(!(this.$module.$config && this.$module.$config.utilities && this.$module.$config.utilities.path)) {
				if(callback) callback(null, { 'self': this.$module.name, 'type': 'utilities', 'status': null });
				return;
			}

			if(!this.$module.$utilities) {
				this.$module['$utilities'] = {};
			}

			var definedUtilities = this._findFiles(path.join(this.$basePath, this.$module.$config.utilities.path), 'utility.js'),
				didLoadUtilities = null;
			for(var idx in definedUtilities) {
				var utility = require(definedUtilities[idx]).utility;
				if(!utility) continue;

				if(!utility.name || !utility.method)
					continue;

				this.$module.$utilities[utility.name] = utility.method.bind(this.$module);
				this.$module.$utilities[utility.name + 'Async'] = promises.promisify(utility.method.bind(this.$module));

				didLoadUtilities = true;
			}

			if(callback) callback(null, { 'self': this.$module.name, 'type': 'utilities', 'status': didLoadUtilities });
		}
		catch(err) {
			if(callback) callback(err, { 'self': this.$module.name, 'type': 'utilities', 'status': err.message });
		}
	},

	'_loadServices': function(callback) {
		var promiseResolutions = [],
			serviceNames = [],
			self = this;

		try {
			if(!(this.$module.$config && this.$module.$config.services && this.$module.$config.services.path)) {
				if(callback) callback(null, { 'self': this.$module.name, 'type': 'services', 'status': null });
				return;
			}

			if(!this.$module.$services) {
				this.$module['$services'] = {};
			}

			var definedServices = this._findFiles(path.join(this.$basePath, this.$module.$config.services.path), 'service.js');
			for(var idx in definedServices) {
				// Check validity of the definition...
				var Service = require(definedServices[idx]).service;
				if(!Service) continue;

				if(!Service.prototype.name || !Service.prototype.dependencies)
					continue;

				if(!Service.prototype.load || !Service.prototype.initialize || !Service.prototype.start || !Service.prototype.stop || !Service.prototype.uninitialize || !Service.prototype.unload)
					continue;

				// Ok... valid definition. Construct the service
				var serviceInstance = new Service(this.$module);

				// Store the promisified object...
				this.$module.$services[serviceInstance.name] = promises.promisifyAll(serviceInstance);

				// Ask the service to load itself...
				serviceNames.push(serviceInstance.name);
				promiseResolutions.push(serviceInstance.loadAsync());
			}
		}
		catch(err) {
			if(callback) callback(err, { 'self': self.$module.name, 'type': 'services', 'status': err.message });
		}

		// Wait for the services to load...
		this._processPromisesAsync(serviceNames, promiseResolutions)
		.then(function(result) {
			if(callback) callback(null, { 'self': self.$module.name, 'type': 'services', 'status': result });
			return null;
		})
		.catch(function(err) {
			if(callback) callback(err, { 'self': self.$module.name, 'type': 'services', 'status': err.message });
		});
	},

	'_loadComponents': function(callback) {
		var promiseResolutions = [],
			componentNames = [],
			self = this;

		try {
			if(!(this.$module.$config && this.$module.$config.components && this.$module.$config.components.path)) {
				if(callback) callback(null, { 'self': this.$module.name, 'type': 'components', 'status': null });
				return;
			}

			if(!this.$module.$components) {
				this.$module['$components'] = {};
			}

			var definedComponents = this._findFiles(path.join(this.$basePath, this.$module.$config.components.path), 'component.js');
			for(var idx in definedComponents) {
				// Check validity of the definition...
				var Component = require(definedComponents[idx]).component;
				if(!Component) continue;

				if(!Component.prototype.name || !Component.prototype.dependencies)
					continue;

				if(!Component.prototype.load || !Component.prototype.initialize || !Component.prototype.start || !Component.prototype.stop || !Component.prototype.uninitialize || !Component.prototype.unload)
					continue;

				// Ok... valid definition. Construct the component
				var componentInstance = new Component(this.$module);

				// Store the promisified object...
				this.$module.$components[componentInstance.name] = promises.promisifyAll(componentInstance);

				// Ask the component to load itself...
				componentNames.push(componentInstance.name);
				promiseResolutions.push(componentInstance.loadAsync());
			}
		}
		catch(err) {
			if(callback) callback(err, { 'self': self.$module.name, 'type': 'components', 'status': err.message });
		}

		// Wait for the components to load...
		this._processPromisesAsync(componentNames, promiseResolutions)
		.then(function(result) {
			if(callback) callback(null, { 'self': self.$module.name, 'type': 'components', 'status': result });
			return null;
		})
		.catch(function(err) {
			if(callback) callback(err, { 'self': self.$module.name, 'type': 'components', 'status': err.message });
		});
	},

	'_initializeServices': function(callback) {
		var promiseResolutions = [],
			serviceNames = [],
			self = this;

		for(var serviceIdx in this.$module.$services) {
			var thisService = this.$module.$services[serviceIdx];

			serviceNames.push(thisService.name);
			promiseResolutions.push(thisService.initializeAsync());
		}

		// Wait for the services to initialize...
		this._processPromisesAsync(serviceNames, promiseResolutions)
		.then(function(result) {
			if(callback) callback(null, { 'self': self.$module.name, 'type': 'services', 'status': result });
			return null;
		})
		.catch(function(err) {
			if(callback) callback(err, { 'self': self.$module.name, 'type': 'services', 'status': err.message });
		});
	},

	'_initializeComponents': function(callback) {
		var promiseResolutions = [],
			componentNames = [],
			self = this;

		for(var componentIdx in this.$module.$components) {
			var thisComponent = this.$module.$components[componentIdx];

			componentNames.push(thisComponent.name);
			promiseResolutions.push(thisComponent.initializeAsync());
		}

		// Wait for the components to initialize...
		this._processPromisesAsync(componentNames, promiseResolutions)
		.then(function(result) {
			if(callback) callback(null, { 'self': self.$module.name, 'type': 'components', 'status': result });
			return null;
		})
		.catch(function(err) {
			if(callback) callback(err, { 'self': self.$module.name, 'type': 'components', 'status': err.message });
		});
	},

	'_startServices': function(callback) {
		// Step 1: Setup the dependencyGraph for this operation
		var initOrder = new dependencyGraph(),
			self = this;

		// Step 2: Add the services to the dependency graph
		for(var serviceIdx in this.$module.$services) {
			var thisService = this.$module.$services[serviceIdx];
			initOrder.addNode(thisService.name);
		}

		// Step 3: Add the dependencies for each service
		for(var serviceIdx in this.$module.$services) {
			var thisService = this.$module.$services[serviceIdx];

			for(var depIdx in thisService.dependencies) {
				var thisServiceDependency = thisService.dependencies[depIdx];

				try {
					initOrder.addDependency(thisService.name, thisServiceDependency);
				}
				catch(err) {
					console.error('Add dependency Error: ', err.message);
				}
			}
		}

		// Step 4: Start the services in the correct order...
		var initOrderList = initOrder.overallOrder(),
			promiseResolutions = [],
			serviceNames = [];

		for(var initOrderIdx in initOrderList) {
			var thisServiceName = initOrderList[initOrderIdx],
				thisService = this.$module.$services[thisServiceName],
				thisServiceDependencies = {};

			for(var depIdx in thisService.dependencies) {
				var thisServiceDependency = thisService.dependencies[depIdx],
					currentModule = this.$module,
					currentDependency = null;

				while(!!currentModule && !currentDependency) {
					if(!currentModule.$services) {
						currentModule = currentModule.$module;
						continue;
					}

					currentDependency = currentModule.$services[thisServiceDependency];
					if(!currentDependency) currentModule = currentModule.$module;
				}

				if(currentDependency) {
					Object.defineProperty(thisServiceDependencies, thisServiceDependency, {
						'__proto__': null,
						'configurable': true,
						'enumerable': true,
						'get': (currentDependency.getInterface ? currentDependency.getInterface.bind(currentDependency) : currentDependency)
					});
				}
			}

			serviceNames.push(thisService.name);
			promiseResolutions.push(thisService.startAsync.bind(thisService, thisServiceDependencies));
		}

		// Start Services one after the other
		promises.mapSeries(promiseResolutions, function(serviceStart) {
			return serviceStart();
		})
		// Wait for the services to start...
		.then(function(startStatuses) {
			return self._processPromisesAsync(serviceNames, startStatuses);
		})
		.then(function(result) {
			if(callback) callback(null, { 'self': self.$module.name, 'type': 'services', 'status': result });
			return null;
		})
		.catch(function(err) {
			if(callback) callback(err, { 'self': self.$module.name, 'type': 'services', 'status': err.message });
		});
	},

	'_startComponents': function(callback) {
		var promiseResolutions = [],
			componentNames = [],
			self = this;

		// Start each component
		for(var componentIdx in this.$module.$components) {
			var thisComponentName = componentIdx,
				thisComponent = this.$module.$components[thisComponentName],
				thisComponentDependencies = {};

			for(var depIdx in thisComponent.dependencies) {
				var thisComponentDependency = thisComponent.dependencies[depIdx],
					currentModule = this.$module,
					currentDependency = null;

				while(!!currentModule && !currentDependency) {
					if(!currentModule.$services) {
						currentModule = currentModule.$module;
						continue;
					}

					currentDependency = currentModule.$services[thisComponentDependency];
					if(!currentDependency) currentModule = currentModule.$module;
				}

				if(currentDependency) {
					Object.defineProperty(thisComponentDependencies, thisComponentDependency, {
						'__proto__': null,
						'configurable': true,
						'enumerable': true,
						'get': (currentDependency.getInterface ? currentDependency.getInterface.bind(currentDependency) : currentDependency)
					});
				}
			}

			componentNames.push(thisComponent.name);
			promiseResolutions.push(thisComponent.startAsync(thisComponentDependencies));
		}

		// Wait for the components to start...
		this._processPromisesAsync(componentNames, promiseResolutions)
		.then(function(result) {
			if(callback) callback(null, { 'self': self.$module.name, 'type': 'components', 'status': result });
			return null;
		})
		.catch(function(err) {
			if(callback) callback(err, { 'self': self.$module.name, 'type': 'components', 'status': err.message });
		});
	},

	'_stopServices': function(callback) {
		// Step 1: Setup the dependencyGraph for this operation
		var initOrder = new dependencyGraph(),
			self = this;

		// Step 2: Add the services to the dependency graph
		for(var serviceIdx in this.$module.$services) {
			var thisService = this.$module.$services[serviceIdx];
			initOrder.addNode(thisService.name);
		}

		// Step 3: Add the dependencies for each service
		for(var serviceIdx in this.$module.$services) {
			var thisService = this.$module.$services[serviceIdx];

			for(var depIdx in thisService.dependencies) {
				var thisServiceDependency = thisService.dependencies[depIdx];
				try {
					initOrder.addDependency(thisService.name, thisServiceDependency);
				}
				catch(err) {
					console.error('Add dependency Error: ', err.message);
				}
			}
		}

		// Step 4: Stop the services in the correct order...
		var initOrderList = initOrder.overallOrder().reverse(),
			promiseResolutions = [],
			serviceNames = [];

		for(var initOrderIdx in initOrderList) {
			var thisServiceName = initOrderList[initOrderIdx],
				thisService = this.$module.$services[thisServiceName];

			serviceNames.push(thisService.name);
			promiseResolutions.push(thisService.stopAsync.bind(thisService));
		}

		// Stop Services one after the other
		promises.mapSeries(promiseResolutions, function(serviceStop) {
			return serviceStop();
		})
		// Wait for the services to stop...
		.then(function(stopStatuses) {
			return self._processPromisesAsync(serviceNames, stopStatuses);
		})
		.then(function(result) {
			if(callback) callback(null, { 'self': self.$module.name, 'type': 'services', 'status': result });
			return null;
		})
		.catch(function(err) {
			if(callback) callback(err, { 'self': self.$module.name, 'type': 'services', 'status': err.message });
		});
	},

	'_stopComponents': function(callback) {
		var promiseResolutions = [],
			componentNames = [],
			self = this;

		// Step 1: Stop each component
		for(var componentIdx in this.$module.$components) {
			var thisComponent = this.$module.$components[componentIdx];

			componentNames.push(thisComponent.name);
			promiseResolutions.push(thisComponent.stopAsync());
		}

		// Wait for the components to stop...
		this._processPromisesAsync(componentNames, promiseResolutions)
		.then(function(result) {
			if(callback) callback(null, { 'self': self.$module.name, 'type': 'components', 'status': result });
			return null;
		})
		.catch(function(err) {
			if(callback) callback(err, { 'self': self.$module.name, 'type': 'components', 'status': err.message });
		});
	},

	'_uninitializeServices': function(callback) {
		var promiseResolutions = [],
			serviceNames = [],
			self = this;

		for(var serviceIdx in this.$module.$services) {
			var thisService = this.$module.$services[serviceIdx];

			serviceNames.push(thisService.name);
			promiseResolutions.push(thisService.uninitializeAsync());
		}

		// Wait for the services to uninitialize...
		this._processPromisesAsync(serviceNames, promiseResolutions)
		.then(function(result) {
			if(callback) callback(null, { 'self': self.$module.name, 'type': 'services', 'status': result });
			return null;
		})
		.catch(function(err) {
			if(callback) callback(err, { 'self': self.$module.name, 'type': 'services', 'status': err.message });
		});
	},

	'_uninitializeComponents': function(callback) {
		var promiseResolutions = [],
			componentNames = [],
			self = this;

		for(var componentIdx in this.$module.$components) {
			var thisComponent = this.$module.$components[componentIdx];

			componentNames.push(thisComponent.name);
			promiseResolutions.push(thisComponent.uninitializeAsync());
		}

		// Wait for the components to uninitialize...
		this._processPromisesAsync(componentNames, promiseResolutions)
		.then(function(result) {
			if(callback) callback(null, { 'self': self.$module.name, 'type': 'components', 'status': result });
			return null;
		})
		.catch(function(err) {
			if(callback) callback(err, { 'self': self.$module.name, 'type': 'components', 'status': err.message });
		});
	},

	'_unloadUtilities': function (callback) {
		var didUnloadUtility = null;

		for(var idx in this.$module.$utilities) {
			delete this.$module.$utilities[idx];
			didUnloadUtility = true;
		}

		delete this.$module['$utilities'];
		if(callback) callback(null, { 'self': this.$module.name, 'type': 'utilities', 'status': didUnloadUtility });
	},

	'_unloadServices': function(callback) {
		var promiseResolutions = [],
			serviceNames = [],
			self = this;

		for(var idx in self.$module.$services) {
			var thisService = self.$module.$services[idx];

			serviceNames.push(thisService.name);
			promiseResolutions.push(thisService.unloadAsync());
		}

		// Wait for the services to unload...
		this._processPromisesAsync(serviceNames, promiseResolutions)
		.then(function(status) {
			for(var idx in self.$module.$services) {
				delete self.$module.$services[idx];
			}

			if(callback) callback(null, { 'self': self.$module.name, 'type': 'services', 'status': status });
			return null;
		})
		.catch(function(err) {
			if(callback) callback(err, { 'self': self.$module.name, 'type': 'services', 'status': err.message });
		})
		.finally(function() {
			delete self.$module['$services'];
			return null;
		});
	},

	'_unloadComponents': function(callback) {
		var promiseResolutions = [],
			componentNames = [],
			self = this;

		// Step 1: Unload each component
		for(var componentIdx in this.$module.$components) {
			var thisComponent = this.$module.$components[componentIdx];

			componentNames.push(thisComponent.name);
			promiseResolutions.push(thisComponent.unloadAsync());
		}

		// Step 2: Wait for components to unload...
		this._processPromisesAsync(componentNames, promiseResolutions)
		.then(function(status) {
			for(var idx in self.$module.$components) {
				delete self.$module.$components[idx];
			}

			if(callback) callback(null, { 'self': self.$module.name, 'type': 'components', 'status': status });
			return null;
		})
		.catch(function(err) {
			if(callback) callback(err, { 'self': self.$module.name, 'type': 'components', 'status': err.message });
		})
		.finally(function() {
			delete self.$module['$components'];
			return null;
		});
	},

	'_findFiles': function(rootDir, filename) {
		// Sanity check...
		if(!filesystem.existsSync(rootDir)) {
			return [];
		}

		// If this folder contains the file we're looking for, no need to recurse
		// into the sub-folders
		if(filesystem.existsSync(path.join(rootDir, filename))) {
			return [path.join(rootDir, filename)];
		}

		// Step 1: Get the list of files / folders in the rootDir
		var rootDirObjects = filesystem.readdirSync(rootDir),
			finalList = [];

		// Step 2: Process each sub-directory in this directory
		for(var rootDirIdx in rootDirObjects) {
			var thisObjectPath = path.join(rootDir, rootDirObjects[rootDirIdx]);

			var fsStat = filesystem.statSync(thisObjectPath);
			if(fsStat.isDirectory()) {
				finalList = finalList.concat(this._findFiles(thisObjectPath, filename));
				continue;
			}
		}

		return finalList;
	},

	'_filterStatus': function (status) {
		var filteredStatus = [],
			self = this;

		status.forEach(function (thisStatus) {
			if (thisStatus.status === null)
				return;

			if (typeof (thisStatus.status) == 'object') {
				Object.keys(thisStatus.status).forEach(function (key) {
					if (!Array.isArray(thisStatus.status[key]))
						return;

					thisStatus.status[key] = self._filterStatus(thisStatus.status[key]);
					if (!thisStatus.status[key].length) thisStatus.status[key] = true;
				});
			}

			filteredStatus.push(thisStatus);
		});

		return filteredStatus;
	},

	'_processPromises': function(names, promiseResolutions, callback) {
		if(!promiseResolutions.length) {
			if(callback) callback(null, null);
			return;
		}

		promises.all(promiseResolutions)
		.then(function(status) {
			var nameStatusPair = {},
				everythingOK = true;

			for(var idx in status) {
				var thisName = names[idx],
					thisStatus = status[idx];

				nameStatusPair[thisName] = thisStatus;
				everythingOK = everythingOK && thisStatus;
			}

			if(!everythingOK) {
				throw nameStatusPair;
				return;
			}

			if(callback) callback(null, nameStatusPair);
			return null;
		})
		.catch(function(err) {
			if(callback) callback(err);
		});
	}
});

exports.loader = twyrLoader;

