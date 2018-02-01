var socket = io.connect();
var canvas_width = window.innerWidth * window.devicePixelRatio; 
var canvas_height = window.innerHeight * window.devicePixelRatio;
socket.on("connect", function onsocketConnected () {
	console.log("connected to server"); 
});

var MAP_SIZE_X = 15000;
var MAP_SIZE_Y = 7500;
var MAP_MIDDLE_X = MAP_SIZE_X / 2;
var MAP_MIDDLE_Y = MAP_SIZE_Y / 2;
var SCALE = 0.15;
var FIRE_RATE = 10;
var score_span = document.getElementById("score_point");
var health_span = document.getElementById("health_point");
var red_score_span = document.getElementById("red_score_span");
var green_score_span = document.getElementById("green_score_span");
var blue_score_span = document.getElementById("blue_score_span");


var renderer = PIXI.autoDetectRenderer(window.innerWidth, window.innerHeight, {
	antialias: true,
	transparent: true
});
renderer.view.style.position = "absolute";
renderer.view.style.display = "block";
document.body.appendChild(renderer.view);
var stage = new PIXI.Container();
stage.scale = new PIXI.Point(SCALE, SCALE);
renderer.render(stage);
//renderer.autoResize = true;
//renderer.resize(window.innerWidth, window.innerHeight);
//renderer.backgroundColor = 0xfcfcfc;


var xCofactor;
var yCofactor;

var fireVector;
var fireInterval;

function setSizes(){
	console.log("Setting...");
	xCofactor = window.innerWidth / (2 * SCALE);
	yCofactor = window.innerHeight / (2 * SCALE);
	renderer.autoResize = true;
	renderer.resize(window.innerWidth, window.innerHeight);
}

renderer.plugins.interaction.on('mousedown', function(event){
	if(fireInterval != null)
		clearInterval(fireInterval);
	fireVector = {x: event.data.global.x - xCofactor * SCALE, y: event.data.global.y - yCofactor * SCALE};
	fire();
	fireInterval = setInterval(fire, FIRE_RATE);
});

renderer.plugins.interaction.on('mouseout', function(event){
	if(fireInterval != null){
		clearInterval(fireInterval);
		fireInterval = null;
	}
});

renderer.plugins.interaction.on('mousemove', function(event){
	fireVector = {x: event.data.global.x - xCofactor * SCALE, y: event.data.global.y - yCofactor * SCALE};
});

renderer.plugins.interaction.on('mouseup', function(event){
	clearInterval(fireInterval);
	fireInterval = null;
});

/*
renderer.plugins.interaction.on('rightclick', function(event){
	console.log("c");
	var vector = {x: event.data.global.x - xCofactor * SCALE, y: event.data.global.y - yCofactor * SCALE};
	specialFire(vector);
});
*/

window.onresize = setSizes;
window.onload = setSizes;

window.addEventListener("blur", function(event) {
	console.log('blur!');
	resetControls();
}, true);

var FIRE_SPEED = 50;
var PLAYER_SIZE = 216;
var players = {};
var fires = {};
var id;
var myPosition = {x: 0, y: 0};
var move = {x: 0, y: 0};
var control = {left: false, up: false, right: false, down: false};

function getPlayerBody(team){
	var circle = new PIXI.Graphics();
	var color;
	if(team == 'green')
		color = 0x2e8b57;
	else if(team == 'blue')
		color = 0x191970;
	else if(team == 'red')
		color = 0xd20000;
	circle.beginFill(color);
	circle.drawCircle(0, 0, PLAYER_SIZE);   //(x,y,radius)
	circle.endFill();
	return circle;
}

function getFireBody(colorName){
	var circle = new PIXI.Graphics();
	console.log(colorName);
	var color;
	if (colorName == null)
		color = 0;
	else if(colorName == 'green')
		color = 0x2e8b57;
	else if(colorName == 'blue')
		color = 0x191970;
	else if(colorName == 'red')
		color = 0xd20000;
	else
		color = 0;
	circle.beginFill(color);
	circle.drawCircle(0, 0, PLAYER_SIZE / 4);   //(x,y,radius)
	circle.endFill();
	return circle;
}

function resetControls(){
	control.right = false;
	control.left = false;
	control.up = false;
	control.down = false;
	updateControls();
	clearInterval(fireInterval);
}


//stage.addChild(circle);
function gameLoop() {
  requestAnimationFrame(gameLoop);
  renderer.render(stage);
}

window.oncontextmenu = function ()
{
	specialFire();
  return false;     // cancel default menu
}

document.addEventListener('keydown', (event) => {
  const keyName = event.key;
  switch(keyName) {
	  case 'a': case 'A': case 'ArrowLeft':
	   	control.left = true;
	   	updateControls();
	    break;
    case 'd': case 'D': case 'ArrowRight':
	   	control.right = true;
	   	updateControls();
			break;
		case 'w': case 'W': case 'ArrowUp':
	   	control.up = true;
	   	updateControls();
	    break;
    case 's': case 'S': case 'ArrowDown':
	   	control.down = true;
	   	updateControls();
			break;
		case ' ':
			skill1();
			break;
		case 'q': case 'e':
			skill2();
			break;
	}
});

document.addEventListener('keyup', (event) => {
  const keyName = event.key;
  switch(keyName) {
	  case 'a': case 'A': case 'ArrowLeft':
	   	control.left = false;
	    updateControls();
	    break;
    case 'd': case 'D': case 'ArrowRight':
	   	control.right = false;
			updateControls();
			break;
		case 'w': case 'W': case 'ArrowUp':
	   	control.up = false;
	    updateControls();
	    break;
    case 's': case 'S': case 'ArrowDown':
	   	control.down = false;;
			updateControls();
			break;
	}
});

function skill1(){
	socket.emit('skill1');
}

function skill2(){
	socket.emit('skill2');
}

function updateControls(){
	if(control.left){
		move.x = control.right ? 0 : -1;
	}
	else if(control.right){
		move.x = 1;
	}
	else
		move.x = 0;
	if(control.up){
		move.y = control.down ? 0 : 1;
	}
	else if(control.down){
		move.y = -1;
	}
	else
		move.y = 0;
	socket.emit('input', move);
}
var background = PIXI.Sprite.fromImage('client/assets/untitled.svg');
socket.on('initialize', function(data){
	//console.log("My id is " + data.id);
	
	background.x = 0;
	background.y = 0;
	background.width = MAP_SIZE_X;
	background.height = MAP_SIZE_Y;

	stage.addChild(background);

	id = data.id;
	updateTeamScores(data.scores);
	gameLoop();
});

socket.on('removePlayer', function(data){
	var player = players[data];
	if(player != null){
		stage.removeChild(player.body);
		delete players[data];
	}
});

socket.on('updateScore', function(data){
	score_span.innerText = data;
});

socket.on('updateHealth', function(data){
	health_span.innerText = data;
});

function updateTeamScores(data){
	red_score_span.innerText = data.red;
	blue_score_span.innerText = data.blue;
	green_score_span.innerText = data.green;
}

socket.on('updateTeamScores', function(data){
	updateTeamScores(data);
});


socket.on('removeFire', function(data){
	var fire = fires[data];
	if(fire != null){
		stage.removeChild(fires[data].body);
		delete fires[data];
	}
});

socket.on('update', function(data){
	myPosition = data.players[id].position;
	background.x = 0 - myPosition.x + xCofactor;
	background.y = myPosition.y - MAP_SIZE_Y + yCofactor;
	for (var player in data.players) {
	  var temp = players[player];
	  var temp2 = data.players[player];
	  if(temp == null){
	  	players[player] = {body: getPlayerBody(temp2.team)};
	  	temp = players[player];
	  	stage.addChild(temp.body);
	  }
		temp.body.x = temp2.position.x - myPosition.x + xCofactor;
		temp.body.y = myPosition.y - temp2.position.y + yCofactor;
	}
	for (var fire in data.fires) {
	  var temp = fires[fire];
	  var temp2 = data.fires[fire];
	  if(temp == null){
	  	fires[fire] = {body: getFireBody(temp2.team)};
	  	temp = fires[fire];
	  	stage.addChild(temp.body);
	  }
		temp.body.x = temp2.position.x - myPosition.x + xCofactor;
		temp.body.y = myPosition.y - temp2.position.y + yCofactor;
	}
});

function normalizeVector(vector, scale){
	//console.log(vector);
	var norm = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
	var normalized = {x: 0, y: 0};
  if (norm != 0) {
    normalized.x = Math.round(scale * vector.x / norm);
    normalized.y = Math.round(scale * vector.y / norm);
  }
  return normalized;
}

function fire(){
	var vector = Object.assign({}, fireVector);
	vector.y = -vector.y;
	vector = normalizeVector(vector, FIRE_SPEED);
	socket.emit('fire', vector);
}

function specialFire(){
	var vector = Object.assign({}, fireVector);
	vector.y = -vector.y;
	vector = normalizeVector(vector, FIRE_SPEED);
	socket.emit('skill3', vector);
}