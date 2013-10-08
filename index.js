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
	var _sentinelReconnectInProgress = false;

	var _connect = function(settings, callback) {
		if(!settings) settings = _getDefaultSettings();
		if(!settings.sentinels || settings.sentinels.length < 1) settings.sentinels = _getDefaultSentinels();

		_masterName = settings.masterName;
		_sentinels = settings.sentinels;

		_setupSentinels(callback);
	};

	var _setupSentinels = function(callback) {
		_getSentinelClient(function(sentinelClient) {
			if(!sentinelClient) {
				callback({
					message: 'Unable to connect to Redis Sentinel'
				});
				return;
			}

			_prioritySentinelClient = sentinelClient;
			_prioritySentinelClient.on('error', _handlePrioritySentinelError);
			_prioritySentinelClient.on('end', _handlePrioritySentinelEnd);

			_getSentinelClient(function(sentinelSubscriptionClient) {
				if(sentinelSubscriptionClient) {
					_prioritySentinelSubscriptionClient = sentinelSubscriptionClient;
					_prioritySentinelSubscriptionClient.on('error', function() {});

					_subscribeToEvents(_prioritySentinelSubscriptionClient);
					_loadMaster(_prioritySentinelClient, callback);
				}
			});
		});
	};

	var _createClient = function(opts) {
		var c = redis.createClient(_master.port, _master.host, opts);

		if(!c) return null;

		_onMasterSwitch(function(message, newMasterHost, newMasterPort) {
			c.host = newMasterHost;
			c.port = newMasterPort;
		});

		return c;
	};

	var _onMasterDown = function(callback) {
		_masterDownCallbacks.push(callback);
	};

	var _onMasterUp = function(callback) {
		_masterUpCallbacks.push(callback);
	};

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

	var _getSentinelClient = function(callback, sentinelIndex) {
		if(!sentinelIndex) sentinelIndex = 0;
		
		client = redis.createClient(_sentinels[sentinelIndex].port, _sentinels[sentinelIndex].host);
		client.on('ready', function() {callback(client);});
		client.on('error', function() {
			client.end();

			if(sentinelIndex + 1 < _sentinels.length) {
				_getSentinelClient(callback, sentinelIndex + 1);
			} else {
				callback(null);
			}
		});
	};

	var _handlePrioritySentinelError = function(err) {
		if(_sentinelReconnectInProgress) return;
		_sentinelReconnectInProgress = true;

		if(_prioritySentinelSubscriptionClient) {
			_prioritySentinelSubscriptionClient.end();
			_prioritySentinelSubscriptionClient = null;
		}
		if(_prioritySentinelClient) {
			_prioritySentinelClient.end();
			_prioritySentinelClient = null;
		}

		_setupSentinels(function() {
			_sentinelReconnectInProgress = false;
		});
	};

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
    sentinel.send_command("SENTINEL", ["get-master-addr-by-name", _masterName], function(err, data) {
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