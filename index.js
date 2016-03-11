/*
 * Name			: index.js
 * Author		: Vish Desai (vishwakarma_d@hotmail.com)
 * Version		: 0.9.1.1
 * Copyright	: Copyright (c) 2014 - 2016 Vish Desai (https://www.linkedin.com/in/vishdesai).
 * License		: The MITNFA License (https://spdx.org/licenses/MITNFA.html).
 * Description	: Entry point into the Twy'r Server Framework
 *
 */

"use strict";

/**
 * Module dependencies.
 */
var promises = require('bluebird'),
	domain = require('domain'),
	path = require('path'),
	printf = require('node-print'),
	repl = require('repl');

// Get what we need - environment, and the configuration specific to that environment
var config = require(path.join(__dirname, 'config', 'index-config')).config,
	env = (process.env.NODE_ENV || 'development').toLowerCase(),
	numCPUs = require('os').cpus().length;

var timeoutMonitor = {},
	cluster = promises.promisifyAll(require('cluster'));

// Instantiate the application, and start the execution
if (cluster.isMaster) {
	cluster
		.on('fork', function(worker) {
			console.log('\nForked Twyr Server #' + worker.id + '\n');
			timeoutMonitor[worker.id] = setTimeout(function() {
				console.error('Twyr Server #' + worker.id + ' did not start in time! KILL!!');
				worker.kill();
			}, 5000);
		})
		.on('online', function(worker, address) {
			console.log('\nTwyr Server #' + worker.id + ': Now online!\n');
			clearTimeout(timeoutMonitor[worker.id]);
		})
		.on('listening', function(worker, address) {
			clearTimeout(timeoutMonitor[worker.id]);

			var networkInterfaces = require('os').networkInterfaces(),
				forPrint = [];

			for(var intIdx in networkInterfaces) {
				var thisNetworkInterface = networkInterfaces[intIdx];
				for(var addIdx in thisNetworkInterface) {
					var thisAddress = thisNetworkInterface[addIdx];
					forPrint.push({
						'Interface': intIdx,
						'Protocol': thisAddress.family,
						'Address': thisAddress.address,
						'Port': address.port
					});
				}
			}

			console.log('Twyr Server #' + worker.id + ': Now listening at:\n');
			if (forPrint.length) printf.printTable(forPrint);
			console.log('\n');
		})
		.on('disconnect', function(worker) {
			console.log('\nTwyr Server #' + worker.id + ': Disconnected\n');
			clearTimeout(timeoutMonitor[worker.id]);
		})
		.on('exit', function(worker, code, signal) {
			console.log('\nTwyr Server #' + worker.id + ': Exited with code: ' + code + ' on signal: ' + signal + '\n');
			clearTimeout(timeoutMonitor[worker.id]);
			if (cluster.isMaster && config['restart']) cluster.fork();
		})
		.on('death', function(worker) {
			console.error('\nTwyr Server #' + worker.pid + ': Death! Restarting...\n');
			clearTimeout(timeoutMonitor[worker.id]);
			if (cluster.isMaster && config['restart']) cluster.fork();
		});

	// Fork workers.
	for (var i = 0; i < (numCPUs * config['loadFactor']); i++) {
		cluster.fork();
	}

	// In development mode (i.e., start as "npm start"), wait for input from command line
	// In other environments, start a telnet server and listen for the exit command
	if(env == 'development') {
		var replConsole = repl.start(config.repl);
		replConsole.on('exit', function() {
			console.log('Twyr Server Master: Stopping now...');
			config['restart'] = false;

			for(var id in cluster.workers) {
				(cluster.workers[id]).send('terminate');
			}

			cluster.disconnectAsync()
			.then(function() {
				console.log('Twyr Server Master: Disconnected workers. Exiting now...');
				return null;
			})
			.timeout(60000)
			.catch(function(err) {
				console.error('Twyr Server Master Exit Error: ' + JSON.stringify(err));
				process.exit(1);
			});
		});
	}
	else {
		var telnetServer = require('net').createServer(function(socket) {
			config.repl.parameters.input = socket;
			config.repl.parameters.output = socket;

			var replConsole = repl.start(config.repl.parameters);
			replConsole.context.socket = socket;

			replConsole.on('exit', function() {
				console.log('Twyr Server Master: Stopping now...');
				config['restart'] = false;

				for(var id in cluster.workers) {
					(cluster.workers[id]).send('terminate');
				}

				cluster.disconnectAsync()
				.then(function() {
					console.log('Twyr Server Master: Disconnected workers. Exiting now...');

					socket.end();
					telnetServer.close();
					return null;
				})
				.timeout(60000)
				.catch(function(err) {
					console.error('Twyr Server Master Exit Error: ' + JSON.stringify(err));
					process.exit(1);
				});
			});
		});

		telnetServer.listen(config.repl.controlPort, config.repl.controlHost);
	}
}
else {
	// Worker processes have a Twyr Server running in their own
	// domain so that the rest of the process is not infected on error
	var serverDomain = domain.create(),
		TwyrServer = require(config['main']).twyrServer,
		twyrServer = promises.promisifyAll(new TwyrServer(null));

	var startupFn = function () {
		// Call load / initialize / start...
		twyrServer.loadAsync()
		.timeout(1000)
		.then(function(status) {
			console.log('Twyr Server #' + cluster.worker.id + '::Load status:\n' + JSON.stringify(status, null, '\t'));
			if(!status) throw status;

			return twyrServer.initializeAsync();
		})
		.timeout(60000)
		.then(function(status) {
			console.log('Twyr Server #' + cluster.worker.id + '::Initialize status:\n' + JSON.stringify(status, null, '\t'));
			if(!status) throw status;

			return twyrServer.startAsync(null);
		})
		.timeout(60000)
		.then(function(status) {
			console.log('Twyr Server #' + cluster.worker.id + '::Start Status:\n' + JSON.stringify(status, null, '\t'));
			if(!status) throw status;

			return null;
		})
		.timeout(60000)
		.catch(function(err) {
			console.error('Twyr Server #' + cluster.worker.id + '::Startup Error:\n' + JSON.stringify(err));
	        cluster.worker.disconnect();
		});
	};

	var shutdownFn = function () {
		twyrServer.stopAsync()
		.then(function(status) {
			console.log('Twyr Server #' + cluster.worker.id + '::Stop Status:\n' + JSON.stringify(status, null, '\t'));
			if(!status) throw status;

			return twyrServer.uninitializeAsync();
		})
		.timeout(60000)
		.then(function(status) {
			console.log('Twyr Server #' + cluster.worker.id + '::Uninitialize Status:\n' + JSON.stringify(status, null, '\t'));
			if(!status) throw status;

			return twyrServer.unloadAsync();
		})
		.timeout(60000)
		.then(function(status) {
			console.log('Twyr Server #' + cluster.worker.id + '::Unload Status:\n' + JSON.stringify(status, null, '\t'));
			if(!status) throw status;

			return null;
		})
		.timeout(60000)
		.catch(function(err) {
			console.error('Twyr Server #' + cluster.worker.id + '::Shutdown Error:\n' + JSON.stringify(err));
		})
		.finally(function() {
	        cluster.worker.disconnect();
			return null;
		});
	};

	process.on('message', function(msg) {
		if(msg != 'terminate') return;
		shutdownFn();
	});

	serverDomain.on('error', function(error) {
		console.log('Twyr Server #' + cluster.worker.id + ': Domain Error:\n', error.stack);
		shutdownFn();
	});

	process.on('uncaughtException', function(err) {
		console.error('Twyr Server #' + cluster.worker.id + ': Process Error: ', err);
		process.exit(1);
	});

	serverDomain.run(startupFn);
}
