
var express        = require('express');
var bodyParser     = require("body-parser");
var helperDB       = require('./lib/helperDB');
var helperMQTT     = require('./lib/helperMQTT');
var onMessageMQTT  = require('./lib/onMessageMQTT');

var app = express();
var globalSocket = null;


var environmentalDB   = new helperDB();
var environmentalMQTT = new helperMQTT();

app.set('views', __dirname + '/tpl');
app.set('view engine', "jade");
app.engine('jade', require('jade').__express);
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({ extended: false }));  
app.use(bodyParser.json()); 


environmentalMQTT.connect(function(clientMQTT){
  //rgister subscribe sensor
  clientMQTT.subscribe("register");

  environmentalDB.connect(function (resDB) {
        if (resDB.success) {
           var sensor = resDB.db.collection('sensorRegister');
           sensor.find().toArray(function(err, result){
                if(!err) {
                  for(index in result) {
                    console.log("subscribe "+result[index].name.toLowerCase());
                    clientMQTT.subscribe(result[index].name.toLowerCase());
                  }
                }
           });


           environmentalMQTT.observer(function (topic, value) {

                  var sensorRegister = resDB.db.collection('sensorRegister');

                  if(topic == "register") {
                    console.log("register "+value.toString());
                    var dataInto = {
                        name:value.toString(), 
                        intoDate:new Date()
                    };
                    sensorRegister.insert(dataInto, function(err, result){
                        if(!err) clientMQTT.subscribe(value.toString().toLowerCase());
                    }); 

                    if(globalSocket != null) {
                      sensorRegister.find().toArray(function(err, result){
                          if(!err) globalSocket.emit('setSensor', result);
                      });
                    }
                  } else if(globalSocket != null){
                     console.log("sensor "+value.toString());
                     var sensor = resDB.db.collection('sensor');
                     var dataInto = {
                        name:topic.toString().toLowerCase(), 
                        intoDate:new Date(), 
                        valueSensor:value.toString()
                     };
                     globalSocket.emit('pushSensor', dataInto);
                     sensor.insert(dataInto, function(err, result){}); 
                  }                          
            });//observer
        } else { 
            console.log('Error helperDB!');
            res.status(500).jsonp({'error':'Internal Error'});
        }
    });
});

app.get('/', function (req, res) {
    res.render("page");
});

app.get('/charts', function(req, res){
    res.render("charts");
    io.sockets.on('connection', function (socket) {
        environmentalDB.connect(function (resDB) {
            if (resDB.success) {
                
                globalSocket = socket;//set global socket

                var sensor = resDB.db.collection('sensorRegister');
                sensor.find().toArray(function(err, result){
                    if(!err) socket.emit('setSensor', result);
                });
                
            } else { //exists problems in conection form helperDB
                console.log('Error helperDB!');
            }
        });//environmentalDB

    });
});

app.get('/rest/sensors', function(req, res){
    environmentalDB.connect(function (response) {
        if (response.success) {
           var sensor = response.db.collection('sensorRegister');
           sensor.find().toArray(function(err, result){
                if(err) res.send(500, err.message);
                else res.status(200).jsonp(result);
           });
        } else { //exists problems in conection form helperDB
            console.log('Error helperDB!');
            res.status(500).jsonp({'error':'Internal Error'});
        }
    });
});

//io Socket
var io = require('socket.io').listen(app.listen(3300, function () { //listener
    console.log('Example app listening on port 3300!');
}));

