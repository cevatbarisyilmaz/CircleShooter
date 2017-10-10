var socket = io.connect();
var canvas_width = window.innerWidth * window.devicePixelRatio; 
var canvas_height = window.innerHeight * window.devicePixelRatio;
socket.on("connect", function onsocketConnected () {
	console.log("connected to server"); 
});

var SCALE = 0.15;


var renderer = PIXI.autoDetectRenderer(window.innerWidth, window.innerHeight, {
	backgroundColor: 0xfcfcfc,
	antialias: true
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

function setSizes(){
	console.log("Setting...");
	xCofactor = window.innerWidth / (2 * SCALE);
	yCofactor = window.innerHeight / (2 * SCALE);
	renderer.autoResize = true;
	renderer.resize(window.innerWidth, window.innerHeight);
}

renderer.plugins.interaction.on('mousedown', function(event){
	console.log('mousedown');
	var vector = {x: event.data.global.x - xCofactor * SCALE, y: event.data.global.y - yCofactor * SCALE};
	console.log(vector);
	fire(vector);
});

renderer.plugins.interaction.on('mousemove', function(event){
	//console.log('mousemove');
	//console.log(data);
});

renderer.plugins.interaction.on('mouseup', function(event){
	console.log('mouseup');
	//console.log(event);
});

window.onresize = setSizes;
window.onload = setSizes;

window.addEventListener("blur", function(event) {
	console.log('blur!');
	resetControls();
}, true);

var FIRE_SPEED = 50;
var PLAYER_SIZE = 213;
var players = {};
var fires = {};
var id;
var myPosition = {x: 0, y: 0};
var move = {x: 0, y: 0};
var control = {left: false, up: false, right: false, down: false}

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

function getFireBody(){
	var circle = new PIXI.Graphics();
	var color;
	circle.beginFill(0);
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
}


//stage.addChild(circle);
function gameLoop() {
  requestAnimationFrame(gameLoop);
  renderer.render(stage);
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

socket.on('initialize', function(data){
	console.log("My id is " + data);
	id = data;
	gameLoop();
});

socket.on('removePlayer', function(data){
	stage.removeChild(players[data].body);
	delete players[data];
});

socket.on('removeFire', function(data){
	stage.removeChild(fires[data].body);
	delete fires[data];
});

socket.on('update', function(data){
	myPosition = data.players[id].position;
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
	  	fires[fire] = {body: getFireBody()};
	  	temp = fires[fire];
	  	stage.addChild(temp.body);
	  }
		temp.body.x = temp2.position.x - myPosition.x + xCofactor;
		temp.body.y = myPosition.y - temp2.position.y + yCofactor;
	}
});

function normalizeVector(vector, scale){
	console.log(vector);
	var norm = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
	var normalized = {x: 0, y: 0};
  if (norm != 0) {
    normalized.x = Math.floor(scale * vector.x / norm);
    normalized.y = Math.floor(scale * vector.y / norm);
  }
  return normalized;
}

function fire(vector){
	vector.y = -vector.y;
	vector = normalizeVector(vector, FIRE_SPEED);
	console.log(vector);
	socket.emit('fire', vector);
}