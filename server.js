const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);

// Serve static files
app.use(express.static(path.join(__dirname)));

// WebSocket server
const wss = new WebSocket.Server({ server });

const MAX_PLAYERS = 10;
const GAME_WIDTH = 1920;
const GAME_HEIGHT = 1080;
const ACCELERATION = 0.15; // Ускорение корабля
const MAX_SPEED = 5; // Максимальная скорость
const FRICTION = 0.98; // Трение (инерция)
const BULLET_SPEED = 8;
const TURN_SPEED = 0.1;

const GAME_STATE = {
  LOBBY: 'lobby',
  PLAYING: 'playing',
  FINISHED: 'finished'
};

let gameState = {
  players: new Map(),
  bullets: [],
  gameLoop: null,
  state: GAME_STATE.LOBBY,
  hostId: null, // ID первого подключившегося игрока
  roundResults: [] // Результаты последнего раунда
};

let playerIdCounter = 0;

// Generate random color for player avoiding collisions
function getRandomColor(usedColors = []) {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#E74C3C',
    '#52BE80', '#F39C12', '#9B59B6', '#3498DB', '#E67E22',
    '#1ABC9C', '#D35400', '#16A085', '#27AE60', '#2980B9'
  ];
  
  // Get available colors (not used)
  const availableColors = colors.filter(color => !usedColors.includes(color));
  
  // If all colors are used, return a random one from all
  if (availableColors.length === 0) {
    return colors[Math.floor(Math.random() * colors.length)];
  }
  
  // Return random color from available ones
  return availableColors[Math.floor(Math.random() * availableColors.length)];
}

// Initialize game loop
function startGameLoop() {
  if (gameState.gameLoop) return;
  
  gameState.state = GAME_STATE.PLAYING;
  gameState.gameLoop = setInterval(() => {
    updateGame();
    broadcastGameState();
  }, 1000 / 60); // 60 FPS
}

function stopGameLoop() {
  if (gameState.gameLoop) {
    clearInterval(gameState.gameLoop);
    gameState.gameLoop = null;
  }
}

function updateGame() {
  // Update players
  gameState.players.forEach((player, id) => {
    if (!player.alive || !player.connected) return;
    
    // Initialize velocity if not exists
    if (player.velocityX === undefined) {
      player.velocityX = 0;
      player.velocityY = 0;
    }
    
    // Apply acceleration in the direction the ship is facing
    const accelX = Math.cos(player.angle) * ACCELERATION;
    const accelY = Math.sin(player.angle) * ACCELERATION;
    
    // Add acceleration to velocity
    player.velocityX += accelX;
    player.velocityY += accelY;
    
    // Apply friction (inertia)
    player.velocityX *= FRICTION;
    player.velocityY *= FRICTION;
    
    // Limit maximum speed
    const speed = Math.sqrt(player.velocityX * player.velocityX + player.velocityY * player.velocityY);
    if (speed > MAX_SPEED) {
      player.velocityX = (player.velocityX / speed) * MAX_SPEED;
      player.velocityY = (player.velocityY / speed) * MAX_SPEED;
    }
    
    // Update position based on velocity
    player.x += player.velocityX;
    player.y += player.velocityY;
    
    // Wrap around screen
    if (player.x < 0) player.x = GAME_WIDTH;
    if (player.x > GAME_WIDTH) player.x = 0;
    if (player.y < 0) player.y = GAME_HEIGHT;
    if (player.y > GAME_HEIGHT) player.y = 0;
  });
  
  // Update bullets
  gameState.bullets = gameState.bullets.filter(bullet => {
    bullet.x += Math.cos(bullet.angle) * BULLET_SPEED;
    bullet.y += Math.sin(bullet.angle) * BULLET_SPEED;
    
    // Remove bullets that are off screen
    if (bullet.x < 0 || bullet.x > GAME_WIDTH || 
        bullet.y < 0 || bullet.y > GAME_HEIGHT) {
      return false;
    }
    
    // Check collision with players
    gameState.players.forEach((player, playerId) => {
      if (!player.alive || playerId === bullet.ownerId) return;
      
      const dx = bullet.x - player.x;
      const dy = bullet.y - player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < 20) { // Hit!
        player.alive = false;
        player.deaths = (player.deaths || 0) + 1;
        
        // Award kill to bullet owner
        const killer = gameState.players.get(bullet.ownerId);
        if (killer) {
          killer.kills = (killer.kills || 0) + 1;
        }
        
        return false; // Remove bullet
      }
    });
    
    return true;
  });
  
  // Check if game should end
  const alivePlayers = Array.from(gameState.players.values()).filter(p => p.alive && p.connected);
  if (alivePlayers.length <= 1 && gameState.players.size > 1 && gameState.state === GAME_STATE.PLAYING) {
    // Game over - calculate results
    endRound();
  }
}

function endRound() {
  stopGameLoop();
  gameState.state = GAME_STATE.FINISHED;
  
  // Calculate results
  const results = Array.from(gameState.players.entries())
    .filter(([id, player]) => player.connected)
    .map(([id, player]) => ({
      id: id,
      name: player.name,
      kills: player.kills || 0,
      deaths: player.deaths || 0,
      alive: player.alive,
      color: player.color
    }))
    .sort((a, b) => {
      // Sort by kills (descending), then by deaths (ascending)
      if (b.kills !== a.kills) return b.kills - a.kills;
      return a.deaths - b.deaths;
    });
  
  gameState.roundResults = results;
  
  // Broadcast results
  broadcastGameState();
  
  // Auto start next round after 10 seconds
  setTimeout(() => {
    resetToLobby();
    // Auto start next round if enough players after 3 seconds in lobby
    setTimeout(() => {
      const connectedPlayers = Array.from(gameState.players.values()).filter(p => p.connected);
      if (connectedPlayers.length >= 2 && gameState.state === GAME_STATE.LOBBY) {
        startGame();
      }
    }, 3000);
  }, 10000);
}

function resetToLobby() {
  gameState.state = GAME_STATE.LOBBY;
  gameState.bullets = [];
  gameState.roundResults = [];
  
  gameState.players.forEach((player, id) => {
    if (player.connected) {
      player.alive = true;
      player.x = Math.random() * GAME_WIDTH;
      player.y = Math.random() * GAME_HEIGHT;
      player.angle = Math.random() * Math.PI * 2;
      player.velocityX = 0;
      player.velocityY = 0;
      player.kills = player.kills || 0;
      player.deaths = player.deaths || 0;
    }
  });
  
  broadcastGameState();
}

function startGame() {
  if (gameState.state !== GAME_STATE.LOBBY) return;
  if (gameState.players.size < 2) return; // Need at least 2 players
  
  // Reset all players for new round
  gameState.bullets = [];
  gameState.players.forEach((player, id) => {
    if (player.connected) {
      player.alive = true;
      player.x = Math.random() * GAME_WIDTH;
      player.y = Math.random() * GAME_HEIGHT;
      player.angle = Math.random() * Math.PI * 2;
      player.velocityX = 0;
      player.velocityY = 0;
      if (!player.kills) player.kills = 0;
      if (!player.deaths) player.deaths = 0;
    }
  });
  
  startGameLoop();
  broadcastGameState();
}

function broadcastGameState() {
  const state = {
    state: gameState.state,
    hostId: gameState.hostId,
    players: Array.from(gameState.players.entries()).map(([id, player]) => ({
      id,
      name: player.name,
      x: player.x,
      y: player.y,
      angle: player.angle,
      color: player.color,
      alive: player.alive,
      connected: player.connected,
      kills: player.kills || 0,
      deaths: player.deaths || 0
    })),
    bullets: gameState.bullets.map(bullet => ({
      x: bullet.x,
      y: bullet.y,
      angle: bullet.angle
    })),
    results: gameState.roundResults
  };
  
  const message = JSON.stringify({ type: 'gameState', data: state });
  
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      // Send to both display and control clients
      if (client.isDisplay || client.isControl) {
        client.send(message);
      }
    }
  });
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const isControl = url.pathname === '/control' || url.pathname === '/mobile';
  const isDisplay = url.pathname === '/display' || url.pathname === '/';
  
  ws.isControl = isControl;
  ws.isDisplay = isDisplay;
  
  if (isControl) {
    // Control client connection - wait for registration
    ws.playerId = null;
    console.log('Control client connected, waiting for registration');
  } else if (isDisplay) {
    // Display connection
    console.log('Display connected');
  }
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (isControl) {
        if (data.type === 'register') {
          const name = (data.name || 'Игрок').trim().substring(0, 20);
          if (name.length < 2) {
            ws.send(JSON.stringify({ type: 'error', message: 'Имя должно содержать минимум 2 символа' }));
            return;
          }
          
          const clientUuid = data.uuid;
          let player = null;
          let playerId = null;
          
          // Check if player with this UUID exists
          if (clientUuid) {
            console.log(`Looking for player with UUID: ${clientUuid}`);
            console.log(`Current players: ${Array.from(gameState.players.values()).map(p => `${p.name} (${p.uuid})`).join(', ')}`);
            
            for (const [id, p] of gameState.players.entries()) {
              if (p.uuid === clientUuid) {
                player = p;
                playerId = id;
                console.log(`Found existing player: ${player.name} (${playerId})`);
                break;
              }
            }
            
            if (!player) {
              console.log(`No existing player found with UUID: ${clientUuid}`);
            }
          } else {
            console.log('No UUID provided by client');
          }
          
          if (player) {
            // Reconnect to existing player - update name if changed
            player.connected = true;
            player.velocityX = 0;
            player.velocityY = 0;
            
            // Update name if user entered a different name
            const newName = name.trim().substring(0, 20);
            if (newName.length >= 2 && newName !== player.name) {
              console.log(`Player ${player.name} (${playerId}) renamed to ${newName}`);
              player.name = newName;
            }
            
            // Position, angle, and other properties are preserved
            ws.playerId = playerId;
            
            ws.send(JSON.stringify({
              type: 'connected',
              playerId: playerId,
              uuid: player.uuid,
              color: player.color,
              name: player.name // Send updated name
            }));
            
            // Send current game state
            broadcastGameState();
            
            console.log(`Player ${player.name} (${playerId}) reconnected. Total players: ${gameState.players.size}`);
          } else {
            // Register new player
            if (gameState.players.size >= MAX_PLAYERS) {
              ws.send(JSON.stringify({ type: 'error', message: 'Игра переполнена' }));
              ws.close();
              return;
            }
            
            const uuid = clientUuid || crypto.randomUUID();
            playerId = `player_${playerIdCounter++}`;
            ws.playerId = playerId;
            
            // Get list of currently used colors
            const usedColors = Array.from(gameState.players.values())
              .map(p => p.color)
              .filter(c => c); // Remove undefined/null
            
            player = {
              id: playerId,
              uuid: uuid,
              name: name,
              x: Math.random() * GAME_WIDTH,
              y: Math.random() * GAME_HEIGHT,
              angle: Math.random() * Math.PI * 2,
              velocityX: 0,
              velocityY: 0,
              color: getRandomColor(usedColors),
              alive: true,
              connected: true,
              kills: 0,
              deaths: 0
            };
            
            // Set first player as host
            if (!gameState.hostId) {
              gameState.hostId = playerId;
            }
            
            gameState.players.set(playerId, player);
            
            ws.send(JSON.stringify({
              type: 'connected',
              playerId: playerId,
              uuid: uuid,
              color: player.color
            }));
            
            // Send current game state
            broadcastGameState();
            
            console.log(`Player ${name} (${playerId}) connected. Total players: ${gameState.players.size}`);
          }
        } else if (data.type === 'disconnect') {
          // Explicit disconnect request
          if (ws.playerId) {
            const player = gameState.players.get(ws.playerId);
            if (player) {
              player.connected = false;
              player.velocityX = 0;
              player.velocityY = 0;
              console.log(`Player ${ws.playerId} disconnected. Total connected: ${Array.from(gameState.players.values()).filter(p => p.connected).length}`);
            }
            ws.close();
          }
        } else if (data.type === 'startGame') {
          // Anyone can start the game (from display or control)
          if (gameState.state === GAME_STATE.LOBBY) {
            const connectedPlayers = Array.from(gameState.players.values()).filter(p => p.connected);
            if (connectedPlayers.length >= 2) {
              startGame();
            }
          }
        } else if (ws.playerId) {
          // Handle game commands
          const player = gameState.players.get(ws.playerId);
          if (!player || !player.connected) return;
          
          // Only allow game actions during playing state
          if (gameState.state !== GAME_STATE.PLAYING) return;
          if (!player.alive) return;
          
          if (data.type === 'turn') {
            // Turn right
            player.angle += TURN_SPEED;
          } else if (data.type === 'shoot') {
            // Create bullet
            const bullet = {
              x: player.x + Math.cos(player.angle) * 30,
              y: player.y + Math.sin(player.angle) * 30,
              angle: player.angle,
              ownerId: ws.playerId
            };
            gameState.bullets.push(bullet);
          }
        }
      }
    } catch (e) {
      console.error('Error parsing message:', e);
    }
  });
  
  ws.on('close', () => {
    if (isControl && ws.playerId) {
      const player = gameState.players.get(ws.playerId);
      if (player) {
        player.connected = false;
        player.velocityX = 0;
        player.velocityY = 0;
        console.log(`Player ${ws.playerId} disconnected. Total connected: ${Array.from(gameState.players.values()).filter(p => p.connected).length}`);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Display: http://localhost:${PORT}`);
  console.log(`Control: http://localhost:${PORT}/control.html`);
});

