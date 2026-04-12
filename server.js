const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const gameState = {
  core: { x: 320, y: 200, vx: 0, vy: 0 },
  players: {},
  paused: false
};

io.on('connection', (socket) => {
  console.log('接続したにゃ:', socket.id);

  const teamIndex = Object.keys(gameState.players).length;
  gameState.players[socket.id] = {
    x: teamIndex % 2 === 0 ? 160 : 480,
    y: 200,
    vx: 0, vy: 0,
    team: teamIndex % 2 === 0 ? 0 : 1,
    hasteActive: false
  };

  const isHost = Object.keys(gameState.players).length === 1;
  socket.emit('init', { ...gameState, isHost });
  socket.broadcast.emit('playerJoined', { id: socket.id, data: gameState.players[socket.id] });

  socket.on('playerMove', (data) => {
    if (gameState.players[socket.id]) {
      gameState.players[socket.id].x = data.x;
      gameState.players[socket.id].y = data.y;
      gameState.players[socket.id].team = data.team;
      gameState.players[socket.id].hasteActive = data.hasteActive;
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

  socket.on('pause', (data) => {
    gameState.paused = data.paused;
    io.emit('paused', data);
  });

  socket.on('shoot', (data) => {
    socket.broadcast.emit('projectileSpawned', data);
  });

  socket.on('haste', (data) => {
    socket.broadcast.emit('hasteUsed', data);
  });

  socket.on('disconnect', () => {
    console.log('切断したにゃ:', socket.id);
    delete gameState.players[socket.id];
    io.emit('playerLeft', socket.id);
  });
});

server.listen(3000, () => {
  console.log('サーバー起動したにゃ！ http://localhost:3000');
});
