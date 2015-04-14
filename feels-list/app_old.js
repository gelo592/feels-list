var request = require('request');
var querystring = require('querystring');
var express = require('express');
var mysql = require('mysql');
var path = require('path');
var app = express();

app.set('view engine', 'jade');
app.use(express.static(path.join(__dirname, 'public')));

var connection = mysql.createConnection({
  host : 'localhost',
  database: 'feeldb',
  user: 'root',
  password : 'linkii'
});

connection.connect();

var client = '3b24ca33e53d4d83a1a05d2497f439ea';
var secret = '3778cb5af85d4beb9e13be5eae15e0f7';
var redirect_uri = 'http://localhost:8888/callback';

app.get('/', function (req, res) {
  var scopes = 'user-read-private user-read-email user-library-read';

  res.redirect('https://accounts.spotify.com/authorize?' + 
    querystring.stringify({
      response_type: 'code',
      client_id: client,
      scope: scopes,
      redirect_uri: redirect_uri
    }));
});

app.get('/callback', function (req, res) {
  var code = req.query.code || null;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    form: {
      code: code,
      redirect_uri: redirect_uri,
      grant_type: 'authorization_code'
    },
    headers: {
      'Authorization': 'Basic ' + (new Buffer(client + ':' + secret).toString('base64'))
    },
    json: true
  };

  request.post(authOptions, function (error, response, body) {
    if (!error & response.statusCode === 200) {
      var access_token = body.access_token;
      var refresh_token = body.refresh_token;

      res.redirect('/scrape?' +
        querystring.stringify({
          access_token: access_token,
          refresh_token: refresh_token,
          next: 'https://api.spotify.com/v1/me/tracks?limit=50'
      }));
    }
    else { 
      console.log("get tracks err: " + error);
    }
  });
});

app.get('/scrape', function(req, res) {
    var options = { 
      url: req.query.next,
      headers : {
        'Authorization' : 'Bearer ' + req.query.access_token
      },
      json: true
    };

    request.get(options, function(error, response, body) {
      console.log(body.next);
      for(var i=0; i < body.items.length; i++) {
        var track = body.items[i].track;
        connection.query(
          'insert into tracks(title, artist) values('+ connection.escape(track.name) + ',' + connection.escape(track.artists[0].name) + ')',
          function(err) {
            if (err) throw err;
        });
      }
      if(body.next != null) {
        res.redirect('/scrape?' +
          querystring.stringify({
            access_token: req.query.access_token,
            refresh_token: req.query.refresh_token,
            next: body.next
        }));
      }
      else {
        connection.query('select * from tracks order by id limit 20', function(err, rows, fields) {
          if (err) throw err;
          var arr = [];
          for(var i=0; i<rows.length; i++) {
            arr.push(rows[i])
          }
          res.render('index', {'items': arr});
        });
      }
    });
});

app.get('/more', function (req, res) {

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

/*app.get('/', function (req, res) {
  connection.query('select * from tracks', function(err, rows, fields) {
    if (err) throw err;
    var arr = [];
    for(var i=0; i<rows.length; i++) {
      arr.push(rows[i])
    }
    res.render('index', {'rows': arr});
  });
});*/

var server = app.listen(8888);


