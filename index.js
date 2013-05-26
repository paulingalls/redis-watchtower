var redis = require('redis');

var Watchtower = function() {
	var _masterName;
	var _sentinels;
	var _prioritySentinelClient;
	var _prioritySentinelSubscriptionClient;
	var _master = {
		host: '',
		port: 6379
	};
	var _masterDownCallbacks = [];
	var _masterUpCallbacks = [];
	var _failoverTriggeredCallbacks = [];
	var _masterSwitchCallbacks = [];

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

	var _createClient = function(opts) {
		var c = redis.createClient(_master.port, _master.host, opts);

		if(!c) return;

		c.newMaster = function(message, newMasterHost, newMasterPort) {
			c.host = newMasterHost;
			c.port = newMasterPort;
		};

		_onMasterSwitch(c.newMaster);

		return c;
	};

	var _onMasterDown = function(callback) {
		_masterDownCallbacks.push(callback);
	};

	var _onMasterUp = function(callback) {
		_masterUpCallbacks.push(callback);
	}

	var _onFailoverTriggered = function(callback) {
		_failoverTriggeredCallbacks.push(callback);
	};

	var _onMasterSwitch = function(callback) {
		_masterSwitchCallbacks.push(callback);
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

	//TODO:- Try to reconnect to Sentinel
	var _handlePrioritySentinelError = function(err) {};
	var _handlePrioritySentinelEnd = function() {};

	var _subscribeToEvents = function(sentinel) {
		sentinel.on('message', _eventHandler);
		sentinel.subscribe('+failover-triggered');
		sentinel.subscribe('+switch-master');
		sentinel.subscribe('+odown');
		sentinel.subscribe('-odown');
	};

	var _eventHandler = function(channel, message) {
		var data = message.split(' ');

		if(data[0] === 'master') {
			if(channel === '+odown') {
				_masterDownCallbacks.forEach(function(callback) {
					if(typeof(callback) == "function") callback();
				});
			}

			if(channel === '-odown') {
				_masterUpCallbacks.forEach(function(callback) {
					if(typeof(callback) == "function") callback();
				});
			}
		}

		if(channel === '+failover-triggered') {
			_failoverTriggeredCallbacks.forEach(function(callback) {
				if(typeof(callback) == "function") callback(message);
			});
		}

		if(channel === '+switch-master') {
			
			if(data) {
				var length = data.length;
				if(length > 1) {
					_master.host = data[length - 2];
					_master.port = data[length - 1];
				}
			}

			_masterSwitchCallbacks.forEach(function(callback) {
				if(typeof(callback) == "function") callback(message, _master.host, _master.port);
			});

			_masterUpCallbacks.forEach(function(callback) {
				if(typeof(callback) == "function") callback();
			});
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

	return {
		connect: _connect,
		createClient: _createClient,
		onMasterDown: _onMasterDown,
		onMasterUp: _onMasterUp,
		onMasterSwitch: _onMasterSwitch
	};
}();

module.exports = Watchtower;