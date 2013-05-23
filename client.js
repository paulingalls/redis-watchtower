var redis = require('redis');
var commands = require('./commands');

var Client = function(host, port, options) {
	this.redisClient = redis.createClient(port, host);

	addCommands(this);
};

var addCommands = function(that) {
	commands.forEach(function (fullCommand) {
		var command = fullCommand.split(' ')[0];

		that[command] = function(args, callback) {
    		that.redisClient[command](args, callback);
		}
	});
};

module.exports = Client;