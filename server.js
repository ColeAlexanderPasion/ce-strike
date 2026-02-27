/**
 * CE Strike - Multiplayer Game Server
 * Node.js + Express + Socket.io
 * Server-authoritative game logic
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────────────
// GAME CONSTANTS
// ─────────────────────────────────────────────
const TICK_RATE = 60;          // server ticks per second
const MAP_WIDTH = 1200;
const MAP_HEIGHT = 800;
const WINS_REQUIRED = 15;      // kills to win
const RESPAWN_TIME = 3000;     // ms
const BULLET_SPEED = 12;
const PLAYER_RADIUS = 14;

// ─────────────────────────────────────────────
// CHARACTER DEFINITIONS
// ─────────────────────────────────────────────
const CHARACTERS = {
  Andree: {
    name: 'Andree',
    color: '#00e5ff',
    maxHealth: 100,
    speed: 3.5,
    damage: 22,
    reloadTime: 1200,
    maxAmmo: 12,
    bulletSize: 4,
    weapon: 'Assault Rifle',
    fireRate: 150
  },
  Chesney: {
    name: 'Chesney',
    color: '#ff6b35',
    maxHealth: 140,
    speed: 2.6,
    damage: 45,
    reloadTime: 2200,
    maxAmmo: 6,
    bulletSize: 7,
    weapon: 'Shotgun Burst',
    fireRate: 600
  },
  Denver: {
    name: 'Denver',
    color: '#b5ff4d',
    maxHealth: 80,
    speed: 4.5,
    damage: 15,
    reloadTime: 800,
    maxAmmo: 20,
    bulletSize: 3,
    weapon: 'SMG',
    fireRate: 80
  },
  Fishcer: {
    name: 'Fishcer',
    color: '#e040fb',
    maxHealth: 90,
    speed: 3.0,
    damage: 70,
    reloadTime: 2500,
    maxAmmo: 5,
    bulletSize: 5,
    weapon: 'Sniper',
    fireRate: 800
  },
  Maybelle: {
    name: 'Maybelle',
    color: '#ffeb3b',
    maxHealth: 110,
    speed: 3.2,
    damage: 30,
    reloadTime: 1500,
    maxAmmo: 8,
    bulletSize: 5,
    weapon: 'Revolver',
    fireRate: 400
  }
};

// ─────────────────────────────────────────────
// MAP - Wall and obstacle definitions
// Each wall: { x, y, w, h }
// ─────────────────────────────────────────────
const WALLS = [
  // Outer boundary walls
  { x: 0,    y: 0,    w: MAP_WIDTH, h: 20 },   // top
  { x: 0,    y: MAP_HEIGHT-20, w: MAP_WIDTH, h: 20 }, // bottom
  { x: 0,    y: 0,    w: 20, h: MAP_HEIGHT },   // left
  { x: MAP_WIDTH-20, y: 0, w: 20, h: MAP_HEIGHT }, // right

  // Central cross structure
  { x: 540,  y: 340,  w: 120, h: 20 },
  { x: 590,  y: 290,  w: 20,  h: 120 },

  // Top-left block cluster
  { x: 100,  y: 100,  w: 120, h: 20 },
  { x: 100,  y: 100,  w: 20,  h: 100 },
  { x: 180,  y: 100,  w: 20,  h: 60 },

  // Top-right block cluster
  { x: 980,  y: 100,  w: 120, h: 20 },
  { x: 1080, y: 100,  w: 20,  h: 100 },
  { x: 1000, y: 100,  w: 20,  h: 60 },

  // Bottom-left block cluster
  { x: 100,  y: 680,  w: 120, h: 20 },
  { x: 100,  y: 600,  w: 20,  h: 100 },
  { x: 180,  y: 640,  w: 20,  h: 60 },

  // Bottom-right block cluster
  { x: 980,  y: 680,  w: 120, h: 20 },
  { x: 1080, y: 600,  w: 20,  h: 100 },
  { x: 1000, y: 640,  w: 20,  h: 60 },

  // Mid-left barrier
  { x: 80,   y: 340,  w: 160, h: 20 },
  { x: 80,   y: 440,  w: 160, h: 20 },

  // Mid-right barrier
  { x: 960,  y: 340,  w: 160, h: 20 },
  { x: 960,  y: 440,  w: 160, h: 20 },

  // Top-center obstacles
  { x: 380,  y: 120,  w: 20,  h: 120 },
  { x: 800,  y: 120,  w: 20,  h: 120 },

  // Bottom-center obstacles
  { x: 380,  y: 560,  w: 20,  h: 120 },
  { x: 800,  y: 560,  w: 20,  h: 120 },

  // Diagonal pillars
  { x: 280,  y: 220,  w: 30,  h: 30 },
  { x: 890,  y: 220,  w: 30,  h: 30 },
  { x: 280,  y: 550,  w: 30,  h: 30 },
  { x: 890,  y: 550,  w: 30,  h: 30 },

  // Extra center cover
  { x: 450,  y: 200,  w: 20,  h: 80 },
  { x: 730,  y: 200,  w: 20,  h: 80 },
  { x: 450,  y: 520,  w: 20,  h: 80 },
  { x: 730,  y: 520,  w: 20,  h: 80 },
];

// Spawn points (away from walls)
const SPAWN_POINTS = [
  { x: 150, y: 200 },
  { x: 1050, y: 200 },
  { x: 150, y: 600 },
  { x: 1050, y: 600 },
  { x: 600, y: 100 },
  { x: 600, y: 700 },
  { x: 300, y: 400 },
  { x: 900, y: 400 },
];

// ─────────────────────────────────────────────
// GAME STATE
// ─────────────────────────────────────────────
let players = {};   // socketId -> player object
let bullets = {};   // bulletId -> bullet object
let bulletIdCounter = 0;
let gameOver = false;
let winner = null;

// ─────────────────────────────────────────────
// HELPER: AABB collision check
// ─────────────────────────────────────────────
function circleWallCollision(cx, cy, radius) {
  for (const w of WALLS) {
    const nearX = Math.max(w.x, Math.min(cx, w.x + w.w));
    const nearY = Math.max(w.y, Math.min(cy, w.y + w.h));
    const dx = cx - nearX;
    const dy = cy - nearY;
    if (dx * dx + dy * dy < radius * radius) return true;
  }
  return false;
}

function getRandomSpawn() {
  const sp = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
  return { x: sp.x, y: sp.y };
}

// ─────────────────────────────────────────────
// GAME LOOP
// ─────────────────────────────────────────────
setInterval(() => {
  if (gameOver) return;

  // Update bullets
  for (const id in bullets) {
    const b = bullets[id];
    b.x += Math.cos(b.angle) * BULLET_SPEED;
    b.y += Math.sin(b.angle) * BULLET_SPEED;
    b.dist += BULLET_SPEED;

    // Remove if out of bounds or past range
    if (b.x < 0 || b.x > MAP_WIDTH || b.y < 0 || b.y > MAP_HEIGHT || b.dist > 900) {
      delete bullets[id];
      continue;
    }

    // Wall collision for bullet
    if (circleWallCollision(b.x, b.y, 3)) {
      delete bullets[id];
      continue;
    }

    // Check player hit
    let hit = false;
    for (const pid in players) {
      const p = players[pid];
      if (pid === b.ownerId) continue;  // can't shoot yourself
      if (!p.alive) continue;

      const dx = p.x - b.x;
      const dy = p.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < PLAYER_RADIUS + b.size) {
        // Deal damage
        p.health -= b.damage;
        hit = true;

        if (p.health <= 0) {
          p.health = 0;
          p.alive = false;

          // Award kill to shooter
          const shooter = players[b.ownerId];
          if (shooter) {
            shooter.kills++;
            io.emit('kill_feed', {
              killer: shooter.name,
              victim: p.name,
              killerChar: shooter.character
            });

            // Check win condition
            if (shooter.kills >= WINS_REQUIRED) {
              gameOver = true;
              winner = shooter.name;
              io.emit('game_over', { winner: shooter.name, character: shooter.character });
            }
          }

          // Schedule respawn
          setTimeout(() => {
            if (players[pid]) {
              const spawn = getRandomSpawn();
              players[pid].x = spawn.x;
              players[pid].y = spawn.y;
              players[pid].health = players[pid].maxHealth;
              players[pid].alive = true;
              players[pid].ammo = players[pid].maxAmmo;
              io.emit('player_respawn', { id: pid });
            }
          }, RESPAWN_TIME);
        }

        delete bullets[id];
        break;
      }
    }
    if (hit) continue;
  }

  // Broadcast state
  io.emit('game_state', {
    players: Object.values(players).map(p => ({
      id: p.id,
      name: p.name,
      character: p.character,
      x: p.x,
      y: p.y,
      angle: p.angle,
      health: p.health,
      maxHealth: p.maxHealth,
      alive: p.alive,
      kills: p.kills,
      color: p.color,
      ammo: p.ammo,
      maxAmmo: p.maxAmmo,
      reloading: p.reloading
    })),
    bullets: Object.values(bullets)
  });

}, 1000 / TICK_RATE);

// ─────────────────────────────────────────────
// SOCKET EVENTS
// ─────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] Player connected: ${socket.id}`);

  // Send map data immediately
  socket.emit('map_data', { walls: WALLS, width: MAP_WIDTH, height: MAP_HEIGHT });

  // Player joins with name and character
  socket.on('join', ({ name, character }) => {
    if (!CHARACTERS[character]) return;
    const ch = CHARACTERS[character];
    const spawn = getRandomSpawn();

    players[socket.id] = {
      id: socket.id,
      name: name || 'Player',
      character: character,
      color: ch.color,
      x: spawn.x,
      y: spawn.y,
      angle: 0,
      health: ch.maxHealth,
      maxHealth: ch.maxHealth,
      speed: ch.speed,
      damage: ch.damage,
      reloadTime: ch.reloadTime,
      maxAmmo: ch.maxAmmo,
      ammo: ch.maxAmmo,
      bulletSize: ch.bulletSize,
      fireRate: ch.fireRate,
      lastShot: 0,
      alive: true,
      kills: 0,
      reloading: false
    };

    console.log(`  > ${name} joined as ${character}`);

    // Send character list and current scoreboard
    socket.emit('joined', {
      id: socket.id,
      characters: CHARACTERS,
      walls: WALLS
    });

    io.emit('player_joined', { name, character });
  });

  // Player movement
  socket.on('player_move', ({ x, y, angle }) => {
    const p = players[socket.id];
    if (!p || !p.alive) return;

    // Validate movement (anti-cheat: max speed check)
    const dx = x - p.x;
    const dy = y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = p.speed * 2.5; // allow slight buffer

    let nx = x, ny = y;
    if (dist > maxDist) {
      nx = p.x + (dx / dist) * maxDist;
      ny = p.y + (dy / dist) * maxDist;
    }

    // Wall collision
    if (!circleWallCollision(nx, ny, PLAYER_RADIUS)) {
      p.x = nx;
      p.y = ny;
    } else if (!circleWallCollision(nx, p.y, PLAYER_RADIUS)) {
      p.x = nx;
    } else if (!circleWallCollision(p.x, ny, PLAYER_RADIUS)) {
      p.y = ny;
    }

    p.angle = angle;
  });

  // Shoot
  socket.on('shoot', () => {
    const p = players[socket.id];
    if (!p || !p.alive || p.reloading) return;
    if (p.ammo <= 0) return;

    const now = Date.now();
    if (now - p.lastShot < p.fireRate) return;

    p.lastShot = now;
    p.ammo--;

    // Shotgun fires multiple pellets
    const isChesney = p.character === 'Chesney';
    const pellets = isChesney ? 5 : 1;
    const spread = isChesney ? 0.25 : 0;

    for (let i = 0; i < pellets; i++) {
      const spreadAngle = p.angle + (Math.random() - 0.5) * spread;
      const bid = bulletIdCounter++;
      bullets[bid] = {
        id: bid,
        ownerId: socket.id,
        x: p.x + Math.cos(p.angle) * 20,
        y: p.y + Math.sin(p.angle) * 20,
        angle: spreadAngle,
        damage: isChesney ? p.damage / pellets : p.damage,
        size: p.bulletSize,
        color: p.color,
        dist: 0
      };
    }

    // Auto-reload when empty
    if (p.ammo <= 0) startReload(socket.id);
  });

  // Manual reload
  socket.on('reload', () => {
    const p = players[socket.id];
    if (!p || p.reloading || p.ammo === p.maxAmmo) return;
    startReload(socket.id);
  });

  socket.on('disconnect', () => {
    console.log(`[-] Player disconnected: ${socket.id}`);
    const p = players[socket.id];
    if (p) io.emit('player_left', { name: p.name });
    delete players[socket.id];
  });

  // Request new game (reset)
  socket.on('new_game', () => {
    if (!gameOver) return;
    resetGame();
    io.emit('game_reset');
  });
});

function startReload(playerId) {
  const p = players[playerId];
  if (!p) return;
  p.reloading = true;
  setTimeout(() => {
    if (players[playerId]) {
      players[playerId].ammo = players[playerId].maxAmmo;
      players[playerId].reloading = false;
    }
  }, p.reloadTime);
}

function resetGame() {
  gameOver = false;
  winner = null;
  bullets = {};
  for (const id in players) {
    const p = players[id];
    const spawn = getRandomSpawn();
    p.x = spawn.x;
    p.y = spawn.y;
    p.health = p.maxHealth;
    p.alive = true;
    p.kills = 0;
    p.ammo = p.maxAmmo;
    p.reloading = false;
  }
}

// ─────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🎮 CE Strike server running at http://localhost:${PORT}`);
  console.log(`   Players can join via browser.\n`);
});
