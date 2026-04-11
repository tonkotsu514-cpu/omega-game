const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const gameState = {
  core: { x: 320, y: 200, vx: 0, vy: 0 },
  players: {}
};

io.on('connection', (socket) => {
  console.log('接続したにゃ:', socket.id);

  gameState.players[socket.id] = {
    x: 160, y: 200, vx: 0, vy: 0,
    team: Object.keys(gameState.players).length % 2 === 0 ? 0 : 1
  };

  socket.emit('init', gameState);
console.log('initで送った内容:', JSON.stringify(gameState));
  socket.broadcast.emit('playerJoined', { id: socket.id, data: gameState.players[socket.id] });

  socket.on('playerMove', (data) => {
    if (gameState.players[socket.id]) {
      gameState.players[socket.id].x = data.x;
      gameState.players[socket.id].y = data.y;
    }
    socket.broadcast.emit('playerMoved', { id: socket.id, x: data.x, y: data.y });
  });

  socket.on('coreKick', (data) => {
    gameState.core.vx = data.vx;
    gameState.core.vy = data.vy;
    io.emit('coreKicked', data);
  });

  socket.on('coreSync', (data) => {
    socket.broadcast.emit('coreSynced', data);
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