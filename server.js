const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  transports: ['polling', 'websocket'],
  cors: { origin: '*' }
});

app.use(express.static('public'));

const gameState = { core: { x: 320, y: 200, vx: 0, vy: 0 }, players: {}, paused: false, bots: {} };
let playerCounter = 0;
let botCounter = 0;
let hostSocketId = null;

io.on('connection', (socket) => {
  console.log('接続したにゃ:', socket.id);
  if (!hostSocketId) hostSocketId = socket.id;
  playerCounter++;
  const teamIndex = Object.keys(gameState.players).length;
  gameState.players[socket.id] = {
    x: teamIndex % 2 === 0 ? 160 : 480, y: 200, vx: 0, vy: 0,
    team: teamIndex % 2 === 0 ? 0 : 1,
    hasteActive: false,
    playerNumber: playerCounter
  };
  const isHostClient = socket.id === hostSocketId;
  socket.emit('init', { ...gameState, isHost: isHostClient });
  socket.broadcast.emit('playerJoined', { id: socket.id, data: gameState.players[socket.id] });

  socket.on('addBot', (data) => {
    if (!data || typeof data.team !== 'number') return;
    const id = `bot_${++botCounter}`;
    gameState.bots[id] = {
      id,
      team: data.team,
      x: data.x,
      y: data.y,
      ownerId: socket.id
    };
    io.emit('botAdded', gameState.bots[id]);
  });

  socket.on('botSync', (payload) => {
    if (!payload || !Array.isArray(payload.list)) return;
    payload.list.forEach((b) => {
      const bot = gameState.bots[b.id];
      if (bot && bot.ownerId === socket.id) {
        Object.assign(bot, b);
      }
    });
    socket.broadcast.emit('botSyncedMulti', payload);
  });

  socket.on('hostSimSync', (data) => {
      if (socket.id !== hostSocketId) return;

     Object.assign(gameState, data);
  });



  socket.on('removeBot', (data) => {
    if (!data || !data.id) return;
    const bot = gameState.bots[data.id];
    if (bot && bot.ownerId === socket.id) {
      delete gameState.bots[data.id];
      io.emit('botRemoved', { id: data.id });
    }
  });

  socket.on('playerMove', (data) => {
    if (gameState.players[socket.id]) {
      gameState.players[socket.id].x = data.x;
      gameState.players[socket.id].y = data.y;
      gameState.players[socket.id].team = data.team;
      gameState.players[socket.id].hasteActive = data.hasteActive;
      gameState.players[socket.id].playerNumber = data.playerNumber;
    }
    socket.broadcast.emit('playerMoved', { id: socket.id, ...data });
  });

  socket.on('coreKick', (data) => {
    gameState.core.vx = data.vx;
    gameState.core.vy = data.vy;
    io.emit('coreKicked', data);
  });
  socket.on('coreSync', (data) => {
    gameState.core = { ...data };
    socket.broadcast.emit('coreSynced', data);
  });
  socket.on('pause', (data) => { gameState.paused = data.paused; io.emit('paused', data); });
  socket.on('shoot', (data) => { socket.broadcast.emit('projectileSpawned', data); });
  socket.on('haste', (data) => { socket.broadcast.emit('hasteUsed', data); });
  socket.on('skillEvent', (data) => { socket.broadcast.emit('skillEvent', { id: socket.id, ...data }); });

  socket.on('disconnect', () => {
    console.log('切断したにゃ:', socket.id);
    const wasHost = socket.id === hostSocketId;
    delete gameState.players[socket.id];
    Object.keys(gameState.bots).forEach((bid) => {
      if (gameState.bots[bid].ownerId === socket.id) {
        delete gameState.bots[bid];
        io.emit('botRemoved', { id: bid });
      }
    });
    if (wasHost) {
      hostSocketId = Object.keys(gameState.players)[0] || null;
      if (hostSocketId) io.to(hostSocketId).emit('becomeHost');
    }
    io.emit('playerLeft', socket.id);
  });
});

const SERVER_TICK = 1000 / 30;
setInterval(() => {
  if (!gameState.core) return;
  io.emit('hostSimSync', {
    core: gameState.core,
    s0: gameState.s0 || 0,
    s1: gameState.s1 || 0,
    goalFlash: gameState.goalFlash || 0,
    goalTeam: gameState.goalTeam ?? -1,
    defaultAi: gameState.defaultAi || null,
    bots: gameState.bots ? Object.values(gameState.bots) : [],
    projectiles: gameState.projectiles || [],
    walls: gameState.walls || [],
    coreDebuffUntil: gameState.coreDebuffUntil || 0,
    coreDebuffTeam: gameState.coreDebuffTeam ?? -1,
  });
}, SERVER_TICK);


const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => {
  console.log('Server listening on port ' + PORT);
});
