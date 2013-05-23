var redis = require('redis');
var client = require('./client');

var Watchtower = function() {
	var _masterName;
	var _sentinels;
	var _prioritySentinelClient;
	var _prioritySentinelSubscriptionClient;
	var _master = {
		host: '',
		port: 6379
	};

	var _connect = function(settings, callback) {
		if(!settings) settings = _getDefaultSettings();
		if(!settings.sentinels || settings.sentinels.length < 1) settings.sentinels = _getDefaultSentinels();

		_masterName = settings.masterName;
		_sentinels = settings.sentinels;

		_prioritySentinelClient = _getSentinelClient();
		if(_prioritySentinelClient === null) {
			callback({
				message: 'Unable to connect to Redis Sentinel'
			});
		} else {
			_prioritySentinelSubscriptionClient = _getSentinelClient();
			_prioritySentinelClient.on('error', _handlePrioritySentinelError);
			_prioritySentinelClient.on('end', _handlePrioritySentinelEnd);
			_subscribeToEvents(_prioritySentinelSubscriptionClient);
			_loadMaster(_prioritySentinelClient, callback);
		}
	};
	

	var _getDefaultSettings = function() {
		return {
			masterName: 'mymaster',
			sentinels: _getDefaultSentinels()
		};
	};

	var _getDefaultSentinels = function() {
		return [{
			host: '127.0.0.1',
			port: 26379
		}];
	};

	var _getSentinelClient = function() {
		var client;

		for(var i = 0, length = _sentinels.length; i < length; i++) {
			client = redis.createClient(_sentinels[i].port, _sentinels[i].host);
			if(client) return client;
		}

		return client;
	};

	var _handlePrioritySentinelError = function(err) {};
	var _handlePrioritySentinelEnd = function() {};

	var _handleMasterError = function(err) {
		console.log('Redis Error: ' + err);

		_master.client.end();
		_master.client = null;
	};
	var _handleMasterEnd = function() {
		console.log('Master Connection End');
		_master.client = null;
	};

	var _subscribeToEvents = function(sentinel) {
		sentinel.on('message', _eventHandler);
		sentinel.subscribe('+failover-end');
		sentinel.subscribe('+switch-master');
	};

	var _eventHandler = function(channel, message) {
		console.log(channel);
		console.log(message);

		if(channel === '+switch-master') {
			console.log('OMG!!! NEW MST3R5!!! MusT HANDLE!!!1');
		}
	};

	//TODO:- This should try the priority sentinel, but then check other sentinels if the priority doesn't work
	var _loadMaster = function(sentinel, callback) {
		sentinel.sentinel('get-master-addr-by-name', _masterName, function(err, data) {
			if(data && data.length > 1) {
				_master.host = data[0];
				_master.port = data[1];
				callback();
			}
		})
	};

	var _createClient = function() {
		return new client(_master.host, _master.port);
	};

	return {
		Connect: _connect,
		CreateClient: _createClient
	};
}();

module.exports = Watchtower;