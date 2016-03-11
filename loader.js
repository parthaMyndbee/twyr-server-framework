/*
 * Name			: loader.js
 * Author		: Vish Desai (vishwakarma_d@hotmail.com)
 * Version		: 0.9.1
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
	'constructor': function(basePath, module) {
		// Sanity Check: The module itself must be valid...
		if(!module.name || !module.dependencies) {
			return;
		}

		if(!module.load || !module.initialize || !module.start || !module.stop || !module.uninitialize || !module.unload){
			return;
		}

		Object.defineProperty(this, '$basePath', {
			'__proto__': null,
			'value': path.resolve(basePath)
		});

		Object.defineProperty(this, '$module', {
			'__proto__': null,
			'value': module
		});
	},

	'load': function(callback) {
		var promiseResolutions = [],
			self = this;

		promiseResolutions.push(self._loadUtilitiesAsync());
		promiseResolutions.push(self._loadServicesAsync());
		promiseResolutions.push(self._loadComponentsAsync());

		promises.all(promiseResolutions)
		.then(function(status) {
			if(!status) throw status;
			if(callback) callback(null, status);

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
			if(callback) callback(null, status);

			return null;
		})
		.catch(function(err) {
			if(callback) callback(err);
		});
	},

	'start': function(dependencies, callback) {
		var self = this,
			finalStatus = [];

		self._startServicesAsync(dependencies)
		.then(function(status) {
			if(!status) throw status;
			finalStatus.push(status);

			return self._startComponentsAsync(dependencies);
		})
		.then(function(status) {
			if(!status) throw status;
			finalStatus.push(status);

			if (callback) callback(null, finalStatus);
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

			if (callback) callback(null, finalStatus);
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

			if (callback) callback(null, status);
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
			if(callback) callback(null, status);
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

			var definedUtilities = this._findFiles(path.join(this.$basePath, this.$module.$config.utilities.path), 'utility.js');
			for(var idx in definedUtilities) {
				var utility = require(definedUtilities[idx]).utility;
				if(!utility) continue;

				if(!utility.name || !utility.method)
					continue;

				this.$module.$utilities[utility.name] = utility.method.bind(this.$module);
				this.$module.$utilities[utility.name + 'Async'] = promises.promisify(utility.method.bind(this.$module));
			}

			if(callback) callback(null, { 'self': this.$module.name, 'type': 'utilities', 'status': null });
		}
		catch(err) {
			if(callback) callback(err);
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
				var service = require(definedServices[idx]).service;
				if(!service) continue;

				if(!service.prototype.name || !service.prototype.dependencies)
					continue;

				if(!service.prototype.load || !service.prototype.initialize || !service.prototype.start || !service.prototype.stop || !service.prototype.uninitialize || !service.prototype.unload)
					continue;

				// Ok... valid definition. Construct the service
				service = new service();

				// Create a loader for this service
				var serviceLoader = promises.promisifyAll(new twyrLoader(path.dirname(definedServices[idx]), service), {
					'filter': function(name, func) {
						return true;
					}
				});

				// Store the promisified object...
				this.$module.$services[service.name] = promises.promisifyAll(service);

				// Ask the service to load itself...
				serviceNames.push(service.name);
				promiseResolutions.push(service.loadAsync(this.$module, serviceLoader));
			}
		}
		catch(err) {
			if(callback) callback(err);
		}

		// Wait for the services to load...
		this._processPromisesAsync(serviceNames, promiseResolutions)
		.then(function(result) {
			if(callback) callback(null, { 'self': self.$module.name, 'type': 'services', 'status': result });
			return null;
		})
		.catch(function(err) {
			if(callback) callback(err);
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
				var component = require(definedComponents[idx]).component;
				if(!component) continue;

				if(!component.prototype.name || !component.prototype.dependencies)
					continue;

				if(!component.prototype.load || !component.prototype.initialize || !component.prototype.start || !component.prototype.stop || !component.prototype.uninitialize || !component.prototype.unload)
					continue;

				// Ok... valid definition. Construct the component
				component = new component();

				// Create a loader for this service
				var componentLoader = promises.promisifyAll(new twyrLoader(path.dirname(definedComponents[idx]), component), {
					'filter': function(name, func) {
						return true;
					}
				});

				// Store the promisified object...
				this.$module.$components[component.name] = promises.promisifyAll(component);

				// Ask the component to load itself...
				componentNames.push(component.name);
				promiseResolutions.push(component.loadAsync(this.$module, componentLoader));
			}
		}
		catch(err) {
			if(callback) callback(err);
		}

		// Wait for the components to load...
		this._processPromisesAsync(componentNames, promiseResolutions)
		.then(function(result) {
			if(callback) callback(null, { 'self': self.$module.name, 'type': 'components', 'status': result });
			return null;
		})
		.catch(function(err) {
			if(callback) callback(err);
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
			if(callback) callback(err);
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
			if(callback) callback(err);
		});
	},

	'_startServices': function(dependencies, callback) {
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

		console.log('Service Start Order for ' + this.$module.name + ':\n' + JSON.stringify(initOrderList, null, '\t'));
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
			promiseResolutions.push(thisService.startAsync(thisServiceDependencies));
		}

		// Wait for the services to start...
		this._processPromisesAsync(serviceNames, promiseResolutions)
		.then(function(result) {
			if(callback) callback(null, { 'self': self.$module.name, 'type': 'services', 'status': result });
			return null;
		})
		.catch(function(err) {
			if(callback) callback(err);
		});
	},

	'_startComponents': function(dependencies, callback) {
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
			if(callback) callback(err);
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

		console.log('Service Stop Order for ' + this.$module.name + ':\n' + JSON.stringify(initOrderList, null, '\t'));
		for(var initOrderIdx in initOrderList) {
			var thisServiceName = initOrderList[initOrderIdx],
				thisService = this.$module.$services[thisServiceName];

			serviceNames.push(thisService.name);
			promiseResolutions.push(thisService.stopAsync());
		}

		// Wait for the services to stop...
		this._processPromisesAsync(serviceNames, promiseResolutions)
		.then(function(result) {
			if(callback) callback(null, { 'self': self.$module.name, 'type': 'services', 'status': result });
			return null;
		})
		.catch(function(err) {
			if(callback) callback(err);
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
			if(callback) callback(err);
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
			if(callback) callback(err);
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
			if(callback) callback(err);
		});
	},

	'_unloadUtilities': function(callback) {
		for(var idx in this.$module.$utilities) {
			delete this.$module.$utilities[idx];
		}

		delete this.$module['$utilities'];
		if(callback) callback(null, { 'self': this.$module.name, 'type': 'utilities', 'status': null });
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
			if(callback) callback(err);
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

		// Step 1: Stop each component
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
			if(callback) callback(err);
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

