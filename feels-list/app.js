
var request = require('request'),
	querystring = require('querystring'),
  express = require('express'),
  mysql = require('mysql'),
  path = require('path'),
  redis = require('redis'),
  app = express();

app.set('view engine', 'jade');
app.use(express.static(path.join(__dirname, 'public')));

var connection = mysql.createConnection({
  host : 'localhost',
  database: 'feeldb',
  user: 'root',
  password : 'linkii'
});

var jobPublisherClient = redis.createClient(),
	statusListenerClient = redis.createClient();

statusListenerClient.subscribe("status update");

statusListenerClient.on("message", function(channel, message) {
  console.log(message);
});

/*tessssst
var client1 = redis.createClient(), client2 = redis.createClient(),
  msg_count = 0;

client1.on("subscribe", function (channel, count) {
    client2.publish("a nice channel", "I am sending a message.");
    client2.publish("a nice channel", "I am sending a second message.");
    client2.publish("a nice channel", "I am sending my last message.");
});

client1.on("message", function (channel, message) {
    console.log("client1 channel " + channel + ": " + message);
    msg_count += 1;
    if (msg_count === 3) {
        client1.unsubscribe();
        client1.end();
        client2.end();
    }
});

client1.incr("did a thing");
client1.subscribe("a nice channel");
//end test*/

app.get('/', function(req, res) {
	res.render('index');
});

app.get('/loading', function(req, res) {
	//ask DB if we have tracks
	connection.query("select * from test limit 20", function(err, rows, fields) {
		console.log(rows);
		if((err && err.code == 'ER_NO_SUCH_TABLE') || (rows && rows.length == 0)) {
			//tell redis to start track fetching job
			res.render('loading');
			console.log("no table");
	    jobPublisherClient.publish("job request", "yo, gimme tracks");
		}
		else if(err) {
			res.location('/toading');
			res.render('toading');
			console.log("fire!");
		}
		else {
			//show some tracks
			console.log("tables here")
			var arr = [];
      for(var i=0; i<rows.length; i++) {
        arr.push(rows[i]);
      }
      res.location('/tracks');
      res.render('tracks', {'items': arr});
		}
	});
});


//job server? where do i put you?
var statusPublisherClient = redis.createClient(),
    jobsListenerClient = redis.createClient();

jobsListenerClient.subscribe("job request");

jobsListenerClient.on("message", function(channel, message) {
	if(message == "yo, gimme tracks") {
		do {
			//make call
			
			//shove response into db
			//send status message
		}while(next);
		//call /tracks
	}
});
//ennnd job server





var server = app.listen(8888);
