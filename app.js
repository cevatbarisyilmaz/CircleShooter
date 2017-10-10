//Server Init
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

//Server Logic

app.get('/', function(req, res) {
	res.sendFile(__dirname + '/client/index.html');
});
app.use('/client', express.static(__dirname + '/client'));

console.log("Server started");

io.on('connection', function(socket) {
   console.log('A user with id ' + socket.id + ' has connected');
   socket.on('disconnect', function () {
      console.log('A user with id ' + socket.id + 'has disconnected');
      removePlayer(socket.id);
   });
   socket.on('input', function (input) {
      //console.log('input!');
      setInput(socket.id, input);
   });
   socket.on('fire', function (vector) {
      //console.log('fire!');
      console.log(vector);
      fire(socket.id, vector);
   });
   socket.emit('initialize', socket.id);
   addPlayer(socket.id);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});

//Game Init
var MAX_SPEED = 25;
var MAX_FIRE_SPEED = 50;
var players = {};
var playerArray = [];
var output = {fires: {}, players:{}};
var MAP_SIZE_X = 10000;
var MAP_SIZE_Y = 5000;
var REFRESH_RATE = 17;
var PLAYER_RADIUS = 213;
var PLAYER_SIZE = 426;
var fires = [];

var redTeam = {};
var blueTeam = {};
var greenTeam = {};
var nextTeam = {name: 'green', reference: greenTeam};
var uniqueNumber = 0;

//Game Logic

function getUniqueNumber(){
	if(uniqueNumber == 1024)
		uniqueNumber = 0;
	return uniqueNumber++;
}
function getStartPosition(){
	return {x: Math.floor(Math.random() * MAP_SIZE_X), y: Math.floor(Math.random() * MAP_SIZE_Y)};
}

function changeNextTeam(){
	const team = nextTeam.name;
  switch(team) {
	  case 'green':
	   	nextTeam = {name: 'blue', reference: blueTeam};
	    break;
    case 'red':
	   	nextTeam = {name: 'green', reference: greenTeam};
			break;
		case 'blue':
	   	nextTeam = {name: 'red', reference: redTeam};
	    break;
	}
}

function addPlayer(id){
	var player = {output: {position: getStartPosition(), team: nextTeam.name}, input: {x: 0, y: 0}, velocity: {x: 0, y: 0}, team: nextTeam.reference};
	nextTeam.reference[id] = player;
	players[id] = player;
	output.players[id] = player.output;
	//playerArray.push(player);
	changeNextTeam();
}

function removePlayer(id){
	delete players[id].team[id];
	delete players[id];
	delete output.players[id];

	io.sockets.emit('removePlayer', id);
}

function removeFire(fire){
	delete fires[fire.id];
	delete output.fires[fire.id];
	io.sockets.emit('removeFire', fire.id);
	console.log('removing...');
}

function setInput(id, input){
	players[id].input = input;
}

function minifyVector(vector, scale){
	var norm = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
	if(norm < scale)
		return vector;
	var normalized = {x: 0, y: 0};
  if (norm != 0) {
    normalized.x = Math.floor(scale * vector.x / norm);
    normalized.y = Math.floor(scale * vector.y / norm);
  }
  return normalized;
}

function fire(id, vector){
	if(vector.x != 0 || vector.y != 0){
		vector = minifyVector(vector, MAX_FIRE_SPEED);
		console.log(vector);
		var instance = {id: getUniqueNumber(), output: {position: Object.assign({}, players[id].output.position)}, vector: vector};
		fires[instance.id] = instance;
		output.fires[instance.id] = instance.output;
	}
}

//Physic Engine

function playerInput(){
	for (var player in players){
		var reference = players[player];
		if(reference.input.x > 0 && reference.velocity.x < MAX_SPEED)
			reference.velocity.x += 1;
		else if(reference.input.x < 0 && reference.velocity.x > -MAX_SPEED)
			reference.velocity.x -= 1;
		else if(reference.input.x == 0){
			if(reference.velocity.x > 0)
				reference.velocity.x -= 1;
			else if(reference.velocity.x < 0)
				reference.velocity.x += 1;
		}
		if(reference.input.y > 0 && reference.velocity.y < MAX_SPEED)
			reference.velocity.y += 1;
		else if(reference.input.y < 0 && reference.velocity.y > -MAX_SPEED)
			reference.velocity.y -= 1;
		else if(reference.input.y == 0){
			if(reference.velocity.y > 0)
				reference.velocity.y -= 1;
			else if(reference.velocity.y < 0)
				reference.velocity.y += 1;
		}
	}
}

function playerMovement(){
	for (var player in players){
		var reference = players[player];
		var normalized = minifyVector(reference.velocity, MAX_SPEED);
		//var normalized = reference.velocity;
		reference.output.position.x += normalized.x;
		reference.output.position.y += normalized.y;
		if(reference.output.position.x < 0){
			reference.output.position.x = 0;
			reference.velocity.x = 0;
		}
		else if(reference.output.position.x > MAP_SIZE_X){
			reference.output.position.x = MAP_SIZE_X;
			reference.velocity.x = 0;
		}
		if(reference.output.position.y < 0){
			reference.output.position.y = 0;
			reference.velocity.y = 0;
		}
		else if(reference.output.position.y > MAP_SIZE_Y){
			reference.output.position.y = MAP_SIZE_Y;
			reference.velocity.y = 0;
		}
	}
}

function fireMovement(){
	for (var fire in fires){
		var reference = fires[fire];
		reference.output.position.x += reference.vector.x;
		if(reference.output.position.x > MAP_SIZE_X || reference.output.position.x < 0){
			removeFire(reference);
			continue;
		}
		reference.output.position.y += reference.vector.y;
		if(reference.output.position.y > MAP_SIZE_Y || reference.output.position.y < 0){
			removeFire(reference);
			continue;
		}
	}
}

function getDistance(v1, v2){
	return Math.sqrt(Math.pow(v1.x - v2.x, 2) + Math.pow(v1.y - v2.y, 2));
}

function sumVectors(v1, v2){
	return {x: v1.x + v2.x, y: v1.y + v2.y};
}

function divideVector(v, d){
	return {x: v.x / d, y: v.y / d};
}

function substractVectors(v1, v2){
	return {x: v1.x - v2.x, y: v1.y - v2.y};
}

function reverseVector(v){
	return {x: -v.x, y: -v.y};
}

function setVector(a, b){
	a.x = b.x;
	a.y = b.y;
}

function floorVector(v){
	v.x = Math.floor(v.x);
	v.y = Math.floor(v.y);
	return v;
}

function calculateBounce(v1, v2){

}

function collide(a, b){
	var da = divideVector(substractVectors(a.output.position, b.output.position), PLAYER_SIZE / 4);
	var db = reverseVector(da);

	var common = divideVector(sumVectors(a.velocity, b.velocity), 2);
	
	var va = sumVectors(da, common);
	var vb = sumVectors(db, common);
	//var c2 = divideVector(sumVectors(a.velocity, b.velocity), 2);
	//console.log(common);
	setVector(a.velocity, floorVector(va));
	setVector(b.velocity, floorVector(vb));
	//setVector(a.velocity, common);
	//setVector(a.velocity, common);
}

function collisionDetection(){
	var previous = [];
	var reference;
	for (var player in players){
		reference = players[player];
		previous.forEach(function(before){
			if(getDistance(reference.output.position, before.output.position) < PLAYER_SIZE){
				collide(reference, before);
			}
		});
		previous.push(reference);
	}
}

function gameLoop(){
	collisionDetection();
	playerMovement();
	fireMovement();
	playerInput();
	io.sockets.emit('update', output);
}
setInterval(gameLoop, REFRESH_RATE);