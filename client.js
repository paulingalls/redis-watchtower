var redis = require('redis');
var commands = require('./commands');

var Client = function(host, port, options, onQuit) {
	console.log('Client constructor...')
	try {
		this.redisClient = redis.createClient(port, host);
	} catch (err) {
		console.log(err);
	}

	addCommands(this);
	this.on = function(eventName, handler) {this.redisClient.on(eventName, handler);};
	this.onQuit = onQuit;
	this.quit = function() {quit(this);};
};

var addCommands = function(that) {
	commands.forEach(function (fullCommand) {
		var command = fullCommand.split(' ')[0];

		that[command] = function(args, callback) {
			try {
	    		that.redisClient[command](args, callback);
	    	} catch (err) {
	    		console.log(err);
	    		callback('error');
	    	}
		}
	});
};

var quit = function(that) {
	that.redisClient.quit();
	that.onQuit(that);
};

module.exports = Client;