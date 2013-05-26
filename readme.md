# Redis-Watchtower

A node.js client library for Redis Sentinel

install
------
    npm install redis-watchtower

usage
------
First of all reference redis-watchtower as follows:

```javascript
var watchtower = require('redis-watchtower');
```

Connect to Redis Sentinel, passing in details of your sentinel servers:

```javascript
var settings = {
	masterName: 'mastername',
	sentinels: [{
		host: '127.0.0.1',
		port: 26379
	}]
};

watchtower.connect(settings, function(err) {
	if(err) {
		console.log(err.message);
	} else {
		console.log('Connected to Sentinel');
	}	
});
```

You may now create redis clients, and use them as normal:

```javascript
var client = watchtower.createClient();

client.get('key1', function(err, data) {
	console.log('key1: ' + data);
	client.quit();
});
```

Client objects are standard Redis clients, with the added benefit that if the master server is replaced, the client is updated as required.