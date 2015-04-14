var express = require('express'), // Express web server framework
  request = require('request'), // "Request" library
  querystring = require('querystring'), 
  mysql = require('mysql'),
  path = require('path'),
  redis = require('redis'),
  cookieParser = require('cookie-parser');

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

var client_id = '3b24ca33e53d4d83a1a05d2497f439ea',
  client_secret = '3778cb5af85d4beb9e13be5eae15e0f7',
  redirect_uri = 'http://localhost:8888/callback';

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = 'spotify_auth_state';

var app = express();

app.set('view engine', 'jade');
app.use(express.static(path.join(__dirname, 'public')))
   .use(cookieParser());

app.get('/', function(req, res) {
  res.render('index');
});

app.get('/login', function(req, res) {
  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope = 'user-read-private user-read-email user-library-read';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});

app.get('/callback', function(req, res) {
  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {

        var access_token = body.access_token,
            refresh_token = body.refresh_token;

        //put tokens in database... then redirect
        connection.query(
          'insert into auth(auth, refresh) values('+ connection.escape(access_token) + ',' + connection.escape(refresh_token) + ')',
          function(err) {
            if (err) throw err;
        });
        // we can also pass the token to the browser to make requests from there
        res.redirect('/authed');
      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
      }
    });
  }
});

app.get('/authed', function(req, res) {
  res.render('authed');
});

app.get('/tracks', function(req, res) {
  console.log("####################################tracks####################################");
  console.log(res);
  console.log("####################################tracks####################################");
  //ask DB if we have tracks
  connection.query("select * from tracks limit 20", function(err, rows, fields) {
    if((err && err.code == 'ER_NO_SUCH_TABLE') || (rows && rows.length == 0)) {
      //tell redis to start track fetching job
      console.log("no table");
    }
    else if(err) {
      console.log("fire!");
    }
    else {
      //show some tracks
      console.log("tables here")
      var arr = [];
      for(var i=0; i<rows.length; i++) {
        arr.push(rows[i]);
      }
      res.render('tracks', {'items': arr});
    }
  });
});

app.get('/loading', function(req, res) {
  //ask DB if we have tracks
  connection.query("select * from tracks limit 20", function(err, rows, fields) {
    if((err && err.code == 'ER_NO_SUCH_TABLE') || (rows && rows.length == 0)) {
      //tell redis to start track fetching job
      res.render('loading');
      console.log("no table");
      jobPublisherClient.publish("job request", "yo, gimme tracks:0");
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
      res.render('tracks', {'items': arr});
    }
  });
});

app.get('/refresh_token', function(req, res) {

  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        'access_token': access_token
      });
    }
  });
});

//job server? where do i put you?
var statusPublisherClient = redis.createClient(),
  jobsListenerClient = redis.createClient();

jobsListenerClient.subscribe("job request");

jobsListenerClient.on("message", function(channel, message) {
  var messageDerta = message.split(':');
  var jobbie = messageDerta[0],
    offset = messageDerta[1];

  if(jobbie == "yo, gimme tracks") {
    connection.query('select * from auth order by id desc limit 1', function(err, rows, fields) {
      if(err) throw err;

      var options = { 
        url: 'https://api.spotify.com/v1/me/tracks?offset=' + offset + '&limit=50',
        headers : {
          'Authorization' : 'Bearer ' + rows[0].auth
        },
        json: true
      };

      request.get(options, function(error, response, body) {
        for(var i=0; i < body.items.length; i++) {
          var track = body.items[i].track;
          connection.query(
            'insert into tracks(title, artist) values('+ connection.escape(track.name) + ',' + connection.escape(track.artists[0].name) + ')',
            function(err) {
              if (err) throw err;
          });
        }
        if(body.offset == 50) {
          request.get({
            uri: 'http://localhost:8888/tracks',
            headers: {
              host: 'localhost:8888',
              connection: 'keep-alive',
              'cache-control': 'max-age=0',
              accept: 'text/html,application/xhtml+xml',
              'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/37.0.2062.120 Safari/537.36',
              'accept-encoding': 'gzip,deflate,sdch',
              'accept-language': 'en-US,en;q=0.8,fr;q=0.6'
            },
          });
        }
        else if(body.next) {
          var msg = "yo, gimme tracks:" + (body.offset + 50);
          jobPublisherClient.publish("job request", msg);;

          //update status
        }
        else {
          request.get({
            uri: 'http://localhost:8888/tracks',
            headers: {
              host: 'localhost:8888',
              connection: 'keep-alive',
              'cache-control': 'max-age=0',
              accept: 'text/html,application/xhtml+xml',
              'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/37.0.2062.120 Safari/537.36',
              'accept-encoding': 'gzip,deflate,sdch',
              'accept-language': 'en-US,en;q=0.8,fr;q=0.6'
            },
          });
        }
      });
    });
  }
});
//ennnd job server

app.listen(8888);