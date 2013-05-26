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
	var _masterSwitchCallbacks = [];
	var _masterDown = false;
	var _clients = [];

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
		if(_masterDown) {
			console.log('MASTER DOWN');
			return;
		}

		console.log('MASTER UP');

		console.log('Getting client: ' + JSON.stringify(_master, null, 2));
		var c = redis.createClient(_master.port, _master.host, opts);

		_clients.push(c);

		return c;
	};

	var _onMasterDown = function(callback) {
		_masterDownCallbacks.push(callback);
	};

	var _onMasterUp = function(callback) {
		_masterUpCallbacks.push(callback);
	}

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

	var _handlePrioritySentinelError = function(err) {};
	var _handlePrioritySentinelEnd = function() {};

	var _subscribeToEvents = function(sentinel) {
		sentinel.on('message', _eventHandler);
		//sentinel.subscribe('+failover-triggered');
		sentinel.subscribe('+switch-master');
		sentinel.subscribe('+odown');
		sentinel.subscribe('-odown');
	};

	var _eventHandler = function(channel, message) {
		console.log('SENTINEL EVENT: channel: ' + channel + ' message: ' + message);
		var data = message.split(' ');

		if(data[0] === 'master') {
			if(channel === '+odown') {
				_masterDown = true;
				_masterDownCallbacks.forEach(function(callback) {
					if(typeof(callback) == "function") callback();
				});
			}

			if(channel === '-odown') {
				_masterDown = false;
				_masterUpCallbacks.forEach(function(callback) {
					if(typeof(callback) == "function") callback();
				});
			}
		}

		if(channel === '+switch-master') {
			
			if(data) {
				var length = data.length;
				if(length > 1) {
					_master.host = data[length - 2];
					_master.port = data[length - 1];
					_masterDown = false;
				}
			}

			console.log('New Master: ' + JSON.stringify(_master, null, 2));

			_masterSwitchCallbacks.forEach(function(callback) {
				if(typeof(callback) == "function") callback(message);
			});

			_masterUpCallbacks.forEach(function(callback) {
				if(typeof(callback) == "function") callback();
			});

			_clients.forEach(function(client) {
				if(!client) return;

				client.port = _master.port;
				client.host = _master.host;
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