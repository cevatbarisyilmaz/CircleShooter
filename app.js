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
      setInput(socket.id, input);
   });
   socket.on('fire', function (vector) {
      fire(socket.id, vector);
   });
   socket.on('skill1', function () {
      skill1(socket.id);
   });
   socket.on('skill2', function () {
      skill2(socket.id);
   });
   socket.on('skill3', function (vector) {
      skill3(socket.id, vector);
   });
   socket.emit('initialize', {id: socket.id, scores: getTeamScores()});
   addPlayer(socket.id);
});

const PORT = process.env.PORT || 8080;
http.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});

//Game Init
var MAX_SPEED = 25;
var MAX_FIRE_SPEED = 50;
var FIRE_LIMIT = 250;
var players = {};
var output = {fires: {}, players:{}, special:{}};
var MAP_SIZE_X = 15000;
var MAP_SIZE_Y = 7500;
var REFRESH_RATE = 17;
var PLAYER_RADIUS = 216;
var FIRE_RADIUS = PLAYER_RADIUS / 4;
var SHOT_DETECTION = PLAYER_RADIUS + FIRE_RADIUS;
var PLAYER_SIZE = PLAYER_RADIUS * 2;
var FIRE_SIZE = FIRE_RADIUS * 2;
var INITIAL_HEALTH = 5;
var PLAYER_BORDER_X2 = MAP_SIZE_X - PLAYER_RADIUS;
var PLAYER_BORDER_X1 = PLAYER_RADIUS;
var PLAYER_BORDER_Y2 = MAP_SIZE_Y - PLAYER_RADIUS;
var PLAYER_BORDER_Y1 = PLAYER_RADIUS;
var fires = {};
var specials = {};
var bots = [];

var SKILL_COOLDOWN1 = 60 * 1000;
var SKILL_COOLDOWN2 = 45 * 1000;
var SKILL_COOLDOWN3 = 30 * 1000;
var SKILL_DURATION_RED = 8 * 1000;
var SKILL_DURATION_BLUE = 10 * 1000;
var SKILL_DURATION_GREEN = 15 * 1000;
var BOUNCE_SHOT_DURATION = 60 * 1000;
var SKILL_COOLDOWN_PASSIVE = 20 * 1000;

var FOLLOWER_SPEED = MAX_FIRE_SPEED;
var BORN_TIME = 0.25 * 1000;

var START_FOLLOW_TIME = 0.25 * 1000;
var DIE_FOLLOW_TIME = 30 * 1000;

var playerCount = 0;

var blueTeam = {name: 'blue', score: 0, playerCount: 0, hasBot: false};
var redTeam = {name: 'red', score: 0, playerCount: 0, hasBot: false};
var greenTeam = {name: 'green', score: 0, playerCount: 0, hasBot: false};
var teams = [blueTeam, redTeam, greenTeam];
var uniqueNumber = 0;

//Game Logic

//addBot();
//addBot();
//addBot();
//addBot();
//addBot();

function halveScores(){
	blueTeam.score = Math.floor(blueTeam.score / 2);
	greenTeam.score = Math.floor(greenTeam.score / 2);
	redTeam.score = Math.floor(redTeam.score / 2);
}

function clearTeamScores(){
	blueTeam.score = 0;
	greenTeam.score = 0;
	redTeam.score = 0;
}

function getTeamScores(){
	return {blue: blueTeam.score, red: redTeam.score, green: greenTeam.score};
}

function sendScores(){
	io.sockets.emit('updateTeamScores', getTeamScores());
}

function decideTeam(){
	if(redTeam.playerCount < blueTeam.playerCount){
		if(redTeam.playerCount < greenTeam.playerCount)
			return redTeam;
		else
			return greenTeam;
	}
	else if (blueTeam.playerCount < greenTeam.playerCount)
		return blueTeam;
	else
		return greenTeam;
}

function getTime(){
	return new Date().getTime();
}

function skill1(id){
	var player = players[id];
	var time = getTime();
	if(player.lastSkill1 + SKILL_COOLDOWN1 > time)
		return;
	player.lastSkill1 = time;
	if(player.team == blueTeam)
		speedSkill(player);
	else if(player.team == redTeam)
		fireLimitSkill(player);
	else if(player.team == greenTeam)
		fireSpeedSkill(player);
}

function skill2(id){
	var player = players[id];
	var time = getTime();
	if(player.lastSkill2 + SKILL_COOLDOWN2 > time)
		return;
	player.lastSkill2 = time;
	circleShot(player);
}

function skill3(id, vector){
	var player = players[id];
	var time = getTime();
	if(player.lastSkill3 + SKILL_COOLDOWN3 > time)
		return;
	player.lastSkill3 = time;
	if(player.team == redTeam)
		followerShot(player, vector);
	else if(player.team == greenTeam)
		bouncerShot(player, vector);
	else if(player.team == blueTeam)
		bornShot(player, vector);
}

function speedSkill(player){
	player.speed *= 2;
	setTimeout(function(){
		player.speed /= 2;
	}, SKILL_DURATION_BLUE);
}

function fireSpeedSkill(player){
	player.fireSpeed *= 2;
	setTimeout(function(){
		player.fireSpeed /= 2;
	}, SKILL_DURATION_GREEN);
}

function fireLimitSkill(player){
	player.fireLimit /= 2;
	setTimeout(function(){
		player.fireLimit *= 2;
	}, SKILL_DURATION_RED);
}

function circleShot(player){
	createFire(player, {x: 0, y: 1}, player.fireSpeed);
	createFire(player, {x: 1, y: 2}, player.fireSpeed);
	createFire(player, {x: 1, y: 1}, player.fireSpeed);
	createFire(player, {x: 2, y: 1}, player.fireSpeed);

	createFire(player, {x: 1, y: 0}, player.fireSpeed);
	createFire(player, {x: 2, y: -1}, player.fireSpeed);
	createFire(player, {x: 1, y: -1}, player.fireSpeed);
	createFire(player, {x: 1, y: -2}, player.fireSpeed);

	createFire(player, {x: 0, y: -1}, player.fireSpeed);
	createFire(player, {x: -1, y: -2}, player.fireSpeed);
	createFire(player, {x: -1, y: -1}, player.fireSpeed);
	createFire(player, {x: -2, y: -1}, player.fireSpeed);

	createFire(player, {x: -1, y: 0}, player.fireSpeed);
	createFire(player, {x: -2, y: 1}, player.fireSpeed);
	createFire(player, {x: -1, y: 1}, player.fireSpeed);
	createFire(player, {x: -1, y: 2}, player.fireSpeed);
}

function createSpecial(player, vector, speed){
	var shot = createFire(player, vector, speed);
	shot.special = true;
	shot.output.team = player.output.team;
	return shot;
}

function followerShot(player, vector){
	if(vector.x == 0 && vector.y == 0)
		return;
	var time = getTime();
	var shot = createSpecial(player, vector, FOLLOWER_SPEED);
	shot.type = 'follow';
	shot.shotTime = time;
	shot.health = 10;
	var shot = createSpecial(player, sumVectors(multiplyVector(vector, 2), {x: vector.x, y: -vector.y}), FOLLOWER_SPEED);
	shot.type = 'follow';
	shot.shotTime = time;
	shot.health = 5;
	var shot = createSpecial(player, sumVectors(multiplyVector(vector, 2), {x: -vector.x, y: vector.y}), FOLLOWER_SPEED);
	shot.type = 'follow';
	shot.shotTime = time;
	shot.health = 5;
}

function bouncerShot(player, vector){
	if(vector.x == 0 && vector.y == 0)
		return;
	var time = getTime();
	var shot = createSpecial(player, vector, MAX_FIRE_SPEED * 2);
	shot.type = 'bounce';
	shot.shotTime = time;
	shot.health = 25;
	var shot = createSpecial(player, sumVectors(multiplyVector(vector, 2), {x: vector.x, y: -vector.y}), MAX_FIRE_SPEED * 2);
	shot.type = 'bounce';
	shot.shotTime = time;
	shot.health = 10;
	var shot = createSpecial(player, sumVectors(multiplyVector(vector, 2), {x: -vector.x, y: vector.y}), MAX_FIRE_SPEED * 2);
	shot.type = 'bounce';
	shot.shotTime = time;
	shot.health = 10;
}

function bornShot(player, vector){
	if(vector.x == 0 && vector.y == 0)
		return;
	var shot = createSpecial(player, vector, MAX_FIRE_SPEED);
	shot.type = 'born';
	shot.bornCooldown = BORN_TIME;
	shot.bornTime = getTime();
	shot.health = 2;
	return shot;
}

function getUniqueNumber(){
	if(uniqueNumber == 2048)
		uniqueNumber = 0;
	return uniqueNumber++;
}
function getStartPosition(){
	return {x: Math.floor(Math.random() * MAP_SIZE_X), y: Math.floor(Math.random() * MAP_SIZE_Y)};
}

function createPlayer(id, team){
	return {id: id, output: {position: getStartPosition(), team: team.name}, input: {x: 0, y: 0}, velocity: {x: 0, y: 0}, team: team, lastShot: 0,
	lastSkill1: 0, lastPassive: 0, lastSkill2: 2, lastSkill3: 0,
	health: INITIAL_HEALTH, score: 0, speed: 1, fireLimit: FIRE_LIMIT, fireSpeed: MAX_FIRE_SPEED};
}

function addPlayer(id){
	var team = decideTeam();
	var player = createPlayer(id, team);
	players[id] = player;
	output.players[id] = player.output;
	team.playerCount++;
	playerCount++;
	if(team.hasBot)
		removeBot(team);
	teams.forEach(function(team){
		if(team.playerCount == 0 && !team.hasBot)
			addBot(team);
	});
}

function addBot(team){
	var id = getUniqueNumber();
	var player = createPlayer(id, team);
	players[id] = player;
	output.players[id] = player.output;
	team.hasBot = true;
	bots.push(player);
	player.nextSkill = 1;
	player.lastTime = 0;
}

function removeBot(team){
	for(var index = 0; index < bots.length; index++){
		if(bots[index].team == team){
			delete players[bots[index].id];
			delete output.players[bots[index].id];
			io.sockets.emit('removePlayer', bots[index].id);
			bots.splice(index, 1);
			team.hasBot = false;
			break;
		}
	}
}

function removeAllBots(){
	teams.forEach(function(team){
		if(team.hasBot)
			removeBot(team);
	});
}

function removePlayer(id){
	var team = players[id].team;
	team.playerCount--;
	playerCount--;
	delete players[id];
	delete output.players[id];
	io.sockets.emit('removePlayer', id);
	if(playerCount == 0){
		removeAllBots();
		clearTeamScores();
	}
	else if(team.playerCount == 0)
		addBot(team);
}

function removeFire(fire){
	delete fires[fire.id];
	delete output.fires[fire.id];
	io.sockets.emit('removeFire', fire.id);
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
    normalized.x = Math.round(scale * vector.x / norm);
    normalized.y = Math.round(scale * vector.y / norm);
  }
  return normalized;
}

function normalizeVector(vector, scale){
	var norm = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
	var normalized = {x: 0, y: 0};
  if (norm != 0) {
    normalized.x = Math.round(scale * vector.x / norm);
    normalized.y = Math.round(scale * vector.y / norm);
  }
  return normalized;
}

function fire(id, vector){
	var player = players[id];
	var time = getTime();
	if(time - player.lastShot > player.fireLimit && (vector.x != 0 || vector.y != 0)){
		player.lastShot = time;
		createFire(player, vector, player.fireSpeed);
	}
}

function createFire(player, vector, speed){
	vector = normalizeVector(vector, speed);
	var instance = {id: getUniqueNumber(), output: {position: Object.assign({}, player.output.position)}, vector: vector, player: player, team: player.output.team};
	fires[instance.id] = instance;
	output.fires[instance.id] = instance.output;
	return instance;
}

function resurrect(player){
	player.output.position = getStartPosition();
	player.health = INITIAL_HEALTH;
	player.score = 0;
	io.to(player.id).emit('updateScore', 0);
}

function damage(a, d, t){
	d.health -= t;
	if(d.health <= 0){
		resurrect(d);
		if(a.health != 10)
			a.health++;
		a.score++;
		io.to(a.id).emit('updateScore', a.score);
		io.to(a.id).emit('updateHealth', a.health);
		a.team.score += 2;
		d.team.score -= 1;
		if(d.team.score < 0)
			d.team.score = 0;
		if(a.team.score >= 1000)
			halveScores();
		sendScores();
	}
	io.to(d.id).emit('updateHealth', d.health);
}

//Physic Engine

function playerInput(){
	for (var player in players){
		var reference = players[player];
		if(reference.input.x > 0 && reference.velocity.x < MAX_SPEED * reference.speed)
			reference.velocity.x += reference.speed;
		else if(reference.input.x < 0 && reference.velocity.x > -MAX_SPEED * reference.speed)
			reference.velocity.x -=  reference.speed;
		else if(reference.input.x == 0){
			if(reference.velocity.x > 0)
				reference.velocity.x -=  reference.speed;
			else if(reference.velocity.x < 0)
				reference.velocity.x +=  reference.speed;
		}
		if(reference.input.y > 0 && reference.velocity.y < MAX_SPEED * reference.speed)
			reference.velocity.y +=  reference.speed;
		else if(reference.input.y < 0 && reference.velocity.y > -MAX_SPEED * reference.speed)
			reference.velocity.y -=  reference.speed;
		else if(reference.input.y == 0){
			if(reference.velocity.y > 0)
				reference.velocity.y -=  reference.speed;
			else if(reference.velocity.y < 0)
				reference.velocity.y +=  reference.speed;
		}
	}
}

function playerMovement(){
	var time = getTime();
	for (var player in players){
		var reference = players[player];
		var normalized = minifyVector(reference.velocity, MAX_SPEED * reference.speed);
		//var normalized = reference.velocity;
		reference.output.position.x += normalized.x;
		reference.output.position.y += normalized.y;
		if(reference.output.position.x < PLAYER_BORDER_X1){
			reference.output.position.x = PLAYER_BORDER_X1;
			reference.velocity.x = 0;
		}
		else if(reference.output.position.x > PLAYER_BORDER_X2){
			reference.output.position.x = PLAYER_BORDER_X2;
			reference.velocity.x = 0;
		}
		if(reference.output.position.y < PLAYER_BORDER_Y1){
			reference.output.position.y = PLAYER_BORDER_Y1;
			reference.velocity.y = 0;
		}
		else if(reference.output.position.y > PLAYER_BORDER_Y2){
			reference.output.position.y = PLAYER_BORDER_Y2;
			reference.velocity.y = 0;
		}
	}
}

function fireMovement(){
	for (var fire in fires){
		var reference = fires[fire];
		reference.output.position.x += reference.vector.x;
		if(reference.output.position.x > MAP_SIZE_X || reference.output.position.x < 0){
			if(reference.special && reference.type == 'bounce'){
				reference.vector.x = -reference.vector.x;
			}
			else{
				removeFire(reference);
				continue;
			}
		}
		reference.output.position.y += reference.vector.y;
		if(reference.output.position.y > MAP_SIZE_Y || reference.output.position.y < 0){
			if(reference.special && reference.type == 'bounce'){
				reference.vector.y = -reference.vector.y;
			}
			else{
				removeFire(reference);
				continue;
			}
		}
		if(reference.special){
			var shot = reference;
			if(shot.type == 'follow'){
				var time = getTime();
				if(shot.shotTime + DIE_FOLLOW_TIME < time){
					removeFire(shot);
				}
				else if(shot.target == null){
					if(shot.shotTime + START_FOLLOW_TIME < time){
						var closestEnemy;
						var closestDistance;
						var move = {x: 0, y: 0};
						var referencePosition = sumVectors(reference.output.position, multiplyVector(reference.vector, 60));
						for (var player in players){
							var reference = players[player];
							var distance = getDistance(referencePosition, reference.output.position);
							if(reference != shot.player && reference.output.team != shot.output.team && (closestEnemy == null || distance < closestDistance)){
								closestEnemy = reference;
								closestDistance = distance;
							}
						}
						if(closestEnemy != null){
							shot.target = closestEnemy;
							shot.seed = 1;
						}
					}
				}
				else{
					//var seed = Math.random();
					var perfectVector = normalizeVector(substractVectors(shot.target.output.position, shot.output.position), FOLLOWER_SPEED);
					var vectorSize = getDistance(shot.vector, {x:0,y:0});
					shot.vector = normalizeVector(sumVectors(perfectVector, multiplyVector(shot.vector, 499)), vectorSize);
					var level = shot.seed == 0 ? 1 : 0;
					shot.seed = shot.seed == 2 ? 0 : shot.seed + 1;
					var downLevel = shot.seed;
					var upLevel = shot.seed;
					if(vectorSize < FOLLOWER_SPEED / 4)
						upLevel = 1;
					shot.vector.x = perfectVector.x > shot.vector.x ? shot.vector.x + upLevel : shot.vector.x - downLevel;
					shot.vector.y = perfectVector.y > shot.vector.y ? shot.vector.y + upLevel : shot.vector.y - downLevel;
					//shot.vector = Object.assign({}, perfectVector);
				}
			}
			else if(reference.type == "bounce"){
				if(reference.shotTime + BOUNCE_SHOT_DURATION < getTime()){
					removeFire(reference);
				}
			}
			else if(reference.type == "born"){
				if(reference.bornTime + reference.bornCooldown < getTime()){
					var shot1 = bornShot(reference.player, {x: 1.66 * reference.vector.x, y: reference.vector.y});
					var shot2 = bornShot(reference.player, {x: reference.vector.x, y: 1.66 * reference.vector.y});
					shot1.output.position = Object.assign({}, reference.output.position);
					shot2.output.position = Object.assign({}, reference.output.position);
					shot1.bornCooldown = reference.bornCooldown + 0.25 * 1000;
					shot2.bornCooldown = reference.bornCooldown + 0.25 * 1000;
					removeFire(reference);
				}
			}
		}
	}
}

function getDistance(v1, v2){
	return Math.sqrt(Math.pow(v1.x - v2.x, 2) + Math.pow(v1.y - v2.y, 2));
}

function multiplyVector(v, s){
	return {x: v.x * s, y: v.y * s};
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
	v.x = Math.round(v.x);
	v.y = Math.round(v.y);
	return v;
}

function collide(a, b){
	var da = divideVector(substractVectors(a.output.position, b.output.position), PLAYER_SIZE / 4);
	var db = reverseVector(da);

	var common = divideVector(sumVectors(a.velocity, b.velocity), 2);
	
	var va = sumVectors(da, common);
	var vb = sumVectors(db, common);

	setVector(a.velocity, floorVector(va));
	setVector(b.velocity, floorVector(vb));

}

function shotDetection(){
	for (var player in players){
		var pr = players[player];
		for(var fire in fires){
			var fr = fires[fire];
			if(pr != fr.player){
				if(getDistance(pr.output.position, fr.output.position) < SHOT_DETECTION){
					if(pr.output.team != fr.team){
						if(fr.special){
							damage(fr.player, pr, 5);
							if(fr.type == 'follow' && fr.target == pr){
								for(var fire2 in fires){
									var fr2 = fires[fire2];
									if(fr2.type == 'follow' && fr2.target == pr && fr2 != fr)
										removeFire(fr2);
								}
							}
						}
						else
							damage(fr.player, pr, 1);
					}
					removeFire(fr);
				}
			}
		}
	}
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
	previous = [];
	var broke;
	for(var fire in fires){
		reference = fires[fire];
		broke = false;
		for(var index = 0; index < previous.length; index++){
			if(reference.team != previous[index].team && getDistance(reference.output.position, previous[index].output.position) < FIRE_SIZE){
				if(reference.special){
					reference.health--;
					if(reference.health == 0)
						removeFire(reference);
				}
				else
					removeFire(reference);
				if(previous[index].special){
					previous[index].health--;
					if(previous[index].health == 0)
						removeFire(previous[index]);
				}
				else{
					removeFire(previous[index]);
				}
				previous.splice(index, 1);
				broke = true;
				break;
			}
		}
		if(!broke){
			previous.push(reference);
		}
	}
}

function gameLoop(){
	botDesicions();
	playerInput();
	collisionDetection();
	shotDetection();
	playerMovement();
	fireMovement();
	io.sockets.emit('update', output);
}

//AI

var AI_FAR_DISTANCE_THRESHOLD = PLAYER_SIZE * 12;
var AI_CLOSE_DISTANCE_THRESHOLD = PLAYER_SIZE * 4;

function botDesicions(){
	var time = getTime();
	var seed = Math.random();
	bots.forEach(function(bot){
		var closestEnemy;
		var closestDistance;
		var move = {x: 0, y: 0};
		for (var player in players){
			var reference = players[player];
			var distance = getDistance(bot.output.position, reference.output.position);
			if(reference != bot && reference.team != bot.team && (closestEnemy == null || distance < closestDistance)){
				closestEnemy = reference;
				closestDistance = distance;
			}
		}
		if(closestEnemy != null){
			if(distance > AI_FAR_DISTANCE_THRESHOLD){
				if(bot.output.position.x > closestEnemy.output.position.x)
					move.x = -1;
				else if(bot.output.position.x < closestEnemy.output.position.x)
					move.x = 1;
				if(bot.output.position.y > closestEnemy.output.position.y)
					move.y = -1;
				else if(bot.output.position.x < closestEnemy.output.position.y)
					move.y = 1;
				setInput(bot.id, move);
			}
			else if(distance < AI_CLOSE_DISTANCE_THRESHOLD){
				if(bot.output.position.x == closestEnemy.output.position.x)
					move.x = Math.random() > 0.5 ? 1 : -1; 
				else if(bot.output.position.x > closestEnemy.output.position.x)
					move.x = 1;
				else if(bot.output.position.x < closestEnemy.output.position.x)
					move.x = -1;
				if(bot.output.position.y == closestEnemy.output.position.y)
					move.y = Math.random() > 0.5 ? 1 : -1; 
				else if(bot.output.position.y > closestEnemy.output.position.y)
					move.y = 1;
				else if(bot.output.position.y < closestEnemy.output.position.y)
					move.y = -1;
				setInput(bot.id, move);
				if(time > bot.lastShot + FIRE_LIMIT){
					var duration = distance / MAX_FIRE_SPEED;
					var fireVector = sumVectors(substractVectors(closestEnemy.output.position, bot.output.position), multiplyVector(closestEnemy.velocity, duration));
					fire(bot.id, fireVector);
					bot.lastFireVector = fireVector;
				}
			}
			else{
				if(time > bot.lastShot + FIRE_LIMIT){
					var duration = distance / MAX_FIRE_SPEED;
					if(seed < 0.25)
						fireVector = sumVectors(substractVectors(closestEnemy.output.position, bot.output.position), multiplyVector(closestEnemy.velocity, duration));
					else if(seed < 0.50)
						fireVector = sumVectors(substractVectors(closestEnemy.output.position, bot.output.position), multiplyVector(closestEnemy.velocity, duration / 2));
					else if(seed < 0.75)
						fireVector = substractVectors(closestEnemy.output.position, bot.output.position);
					else
						fireVector = sumVectors(substractVectors(closestEnemy.output.position, bot.output.position), {x: Math.random() * PLAYER_SIZE - PLAYER_RADIUS, y: Math.random() * PLAYER_SIZE - PLAYER_RADIUS});
					bot.lastFireVector = fireVector;
					fire(bot.id, multiplyVector(sumVectors(bot.lastFireVector, fireVector), 0.5));
				}
				if(seed < 0.1){
					setInput(bot.id, {x: -bot.input.x, y: bot.input.y});
				}
				else if(seed < 0.2){
					setInput(bot.id, {x: bot.input.x, y: -bot.input.y});
				}
				if(bot.lastTime + 30 * 1000 < time){
					if(bot.nextSkill == 1){
						skill1(bot.id);
						bot.nextSkill++;
					}
					else if(bot.nextSkill == 2){
						skill2(bot.id);
						bot.nextSkill++;
					}
					else if(bot.nextSkill == 3){
						skill3(bot.id, bot.lastFireVector);
						bot.nextSkill = 0;
					}
					bot.lastTime = time;
				}
			}
		}
	});
}

setInterval(gameLoop, REFRESH_RATE);