# Redis-Watchtower

A node.js client library for [Redis Sentinel](http://redis.io/topics/sentinel)

install
------
    npm install redis-watchtower

dependancies
------

Redis-Watchtower is dependant upon [node_redis](https://github.com/DocuSignDev/node_redis).  In order to use Redis-Watchtower, however, you will need to make a slight modification to node_redis.

Because [Redis Sentinel](http://redis.io/topics/sentinel) is still on the unstable branch, the sentinel redis command is not included in node_redis, thankfully, it is very easy to eanble this command.

To enable the sentinel command in node_redis, simply open up index.js in the node_redis module, navigate to the command which assigns redis commands to the 'commands' variable (around line number 888) and add "sentinel" to the list.  Alternitively, add "sentinel" to the list in the file 'lib/commands.js' in node_redis.

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