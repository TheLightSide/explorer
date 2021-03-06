var mongoose = require('mongoose')
	, lib = require('../lib/explorer')
	, db = require('../lib/database')
	, settings = require('../lib/settings')
	, request = require('request')
    , Peers = require('../models/peers');

var COUNT = 5000; //number of blocks to index

function exit() {
	mongoose.disconnect();
	process.exit(0);
}

var dbString = 'mongodb://' + settings.dbsettings.user;
dbString = dbString + ':' + settings.dbsettings.password;
dbString = dbString + '@' + settings.dbsettings.address;
dbString = dbString + ':' + settings.dbsettings.port;
dbString = dbString + '/' + settings.dbsettings.database;

 function trim(s, mask) {
	while (~mask.indexOf(s[0])) {
		s = s.slice(1);
	}
	while (~mask.indexOf(s[s.length - 1])) {
	s = s.slice(0, -1);
	}
	return s;
}

mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);
mongoose.connect(dbString, function(err) {
	if (err) {
		console.log('Unable to connect to database: %s', dbString);
		console.log('Aborting');
		exit();
	} else {
		request({uri: 'http://127.0.0.1:' + settings.port + '/api/getpeerinfo', json: true}, function (error, response, body) {
			lib.syncLoop(body.length, function (loop) {
				var i = loop.iteration();
				var address = trim(body[i].addr.substring(0, body[i].addr.lastIndexOf(":")), "[]");
				db.find_peer(address, function(peer) {
					if (peer) {
						// peer already exists, let's update protocol and version
						Peers.updateOne({address:address},
							{
								protocol: body[i].version,
								version: body[i].subver.replace('/', '').replace('/', '')
							}, function(){
								loop.next();
							});
					} else {
						request({uri: 'http://ip-api.com/json/' + address, json: true}, function (error, response, geo) {
							db.create_peer({
								address: address,
								protocol: body[i].version,
								version: body[i].subver.replace('/', '').replace('/', ''),
								country: geo.country,
								country_code: geo.countryCode.toLowerCase()
							}, function(){
								loop.next();
							});
						});
					}
				});
			}, function() {
				exit();
			});
		});
	}
});
