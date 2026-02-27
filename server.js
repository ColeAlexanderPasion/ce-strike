/**
 * CE Strike - Server v2
 * - 60Hz physics, 20Hz broadcast (reduces bandwidth 3x)
 * - Velocity-based movement input (lag-tolerant)
 * - Smaller state payload
 */

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const path    = require('path');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*' },
  // Tune socket.io for lower latency
  pingInterval: 10000,
  pingTimeout:  5000,
  transports: ['websocket', 'polling']   // prefer websocket
});

app.use(express.static(path.join(__dirname, 'public')));

// ─── CONSTANTS ───────────────────────────────
const PHYSICS_HZ   = 60;   // internal simulation rate
const BROADCAST_HZ = 20;   // how often we send state to clients
const MAP_W  = 1200;
const MAP_H  = 800;
const WINS_REQUIRED = 15;
const RESPAWN_MS    = 3000;
const BULLET_SPEED  = 14;   // slightly faster bullets feel snappier
const P_RADIUS      = 14;

// ─── CHARACTERS ──────────────────────────────
const CHARACTERS = {
  Andree:  { color:'#00e5ff', maxHealth:100, speed:4.2, damage:22, reloadTime:1200, maxAmmo:12, bulletSize:4, fireRate:150 },
  Chesney: { color:'#ff6b35', maxHealth:140, speed:3.2, damage:45, reloadTime:2200, maxAmmo:6,  bulletSize:7, fireRate:600 },
  Denver:  { color:'#b5ff4d', maxHealth:80,  speed:5.2, damage:15, reloadTime:800,  maxAmmo:20, bulletSize:3, fireRate:80  },
  Fishcer: { color:'#e040fb', maxHealth:90,  speed:3.6, damage:70, reloadTime:2500, maxAmmo:5,  bulletSize:5, fireRate:800 },
  Maybelle:{ color:'#ffeb3b', maxHealth:110, speed:3.9, damage:30, reloadTime:1500, maxAmmo:8,  bulletSize:5, fireRate:400 }
};

// ─── MAP ─────────────────────────────────────
const WALLS = [
  { x:0,   y:0,   w:MAP_W, h:20 },
  { x:0,   y:MAP_H-20, w:MAP_W, h:20 },
  { x:0,   y:0,   w:20, h:MAP_H },
  { x:MAP_W-20, y:0, w:20, h:MAP_H },
  { x:540, y:340, w:120,h:20 },
  { x:590, y:290, w:20, h:120 },
  { x:100, y:100, w:120,h:20 },
  { x:100, y:100, w:20, h:100 },
  { x:180, y:100, w:20, h:60 },
  { x:980, y:100, w:120,h:20 },
  { x:1080,y:100, w:20, h:100 },
  { x:1000,y:100, w:20, h:60 },
  { x:100, y:680, w:120,h:20 },
  { x:100, y:600, w:20, h:100 },
  { x:180, y:640, w:20, h:60 },
  { x:980, y:680, w:120,h:20 },
  { x:1080,y:600, w:20, h:100 },
  { x:1000,y:640, w:20, h:60 },
  { x:80,  y:340, w:160,h:20 },
  { x:80,  y:440, w:160,h:20 },
  { x:960, y:340, w:160,h:20 },
  { x:960, y:440, w:160,h:20 },
  { x:380, y:120, w:20, h:120 },
  { x:800, y:120, w:20, h:120 },
  { x:380, y:560, w:20, h:120 },
  { x:800, y:560, w:20, h:120 },
  { x:280, y:220, w:30, h:30 },
  { x:890, y:220, w:30, h:30 },
  { x:280, y:550, w:30, h:30 },
  { x:890, y:550, w:30, h:30 },
  { x:450, y:200, w:20, h:80 },
  { x:730, y:200, w:20, h:80 },
  { x:450, y:520, w:20, h:80 },
  { x:730, y:520, w:20, h:80 },
];

const SPAWNS = [
  {x:150,y:200},{x:1050,y:200},{x:150,y:600},{x:1050,y:600},
  {x:600,y:100},{x:600,y:700},{x:300,y:400},{x:900,y:400},
];

// ─── STATE ───────────────────────────────────
let players = {};
let bullets  = {};
let bulletId = 0;
let gameOver = false;
let winner   = null;

// ─── HELPERS ─────────────────────────────────
function circleWallCollision(cx, cy, r) {
  for (const w of WALLS) {
    const nx = Math.max(w.x, Math.min(cx, w.x + w.w));
    const ny = Math.max(w.y, Math.min(cy, w.y + w.h));
    const dx = cx - nx, dy = cy - ny;
    if (dx*dx + dy*dy < r*r) return true;
  }
  return false;
}

function randomSpawn() {
  return SPAWNS[Math.floor(Math.random() * SPAWNS.length)];
}

// ─── PHYSICS LOOP (60 Hz) ────────────────────
// Movement is now server-side: client sends velocity direction + angle
// This means even on a laggy connection the player moves smoothly server-side
setInterval(() => {
  if (gameOver) return;

  const now = Date.now();

  // Move players based on their current velocity input
  for (const id in players) {
    const p = players[id];
    if (!p.alive) continue;

    if (p.vx !== 0 || p.vy !== 0) {
      const nx = p.x + p.vx;
      const ny = p.y + p.vy;

      if (!circleWallCollision(nx, ny, P_RADIUS)) {
        p.x = nx; p.y = ny;
      } else if (!circleWallCollision(nx, p.y, P_RADIUS)) {
        p.x = nx;
      } else if (!circleWallCollision(p.x, ny, P_RADIUS)) {
        p.y = ny;
      }

      // Clamp to map
      p.x = Math.max(P_RADIUS + 20, Math.min(MAP_W - P_RADIUS - 20, p.x));
      p.y = Math.max(P_RADIUS + 20, Math.min(MAP_H - P_RADIUS - 20, p.y));
    }
  }

  // Update bullets
  for (const id in bullets) {
    const b = bullets[id];
    b.x += Math.cos(b.angle) * BULLET_SPEED;
    b.y += Math.sin(b.angle) * BULLET_SPEED;
    b.dist += BULLET_SPEED;

    if (b.x < 0 || b.x > MAP_W || b.y < 0 || b.y > MAP_H || b.dist > 1000) {
      delete bullets[id]; continue;
    }
    if (circleWallCollision(b.x, b.y, 3)) {
      delete bullets[id]; continue;
    }

    let hit = false;
    for (const pid in players) {
      const p = players[pid];
      if (pid === b.ownerId || !p.alive) continue;
      const dx = p.x - b.x, dy = p.y - b.y;
      if (dx*dx + dy*dy < (P_RADIUS + b.size) * (P_RADIUS + b.size)) {
        p.health -= b.damage;
        hit = true;

        // Send immediate hit confirmation to victim
        if (players[pid]) {
          io.to(pid).emit('hit_confirm', { health: Math.max(0, p.health) });
        }

        if (p.health <= 0) {
          p.health = 0;
          p.alive  = false;
          const shooter = players[b.ownerId];
          if (shooter) {
            shooter.kills++;
            io.emit('kill_feed', { killer: shooter.name, victim: p.name, killerChar: shooter.character });
            if (shooter.kills >= WINS_REQUIRED) {
              gameOver = true;
              winner   = shooter.name;
              io.emit('game_over', { winner: shooter.name, character: shooter.character });
            }
          }
          const deadId = pid;
          setTimeout(() => {
            if (!players[deadId]) return;
            const sp = randomSpawn();
            Object.assign(players[deadId], { x: sp.x, y: sp.y, health: players[deadId].maxHealth, alive: true, ammo: players[deadId].maxAmmo });
            io.emit('player_respawn', { id: deadId });
          }, RESPAWN_MS);
        }
        delete bullets[id];
        break;
      }
    }
    if (hit) continue;
  }
}, 1000 / PHYSICS_HZ);

// ─── BROADCAST LOOP (20 Hz) ──────────────────
// Separate from physics — only sends data 20x/sec to reduce bandwidth
setInterval(() => {
  if (gameOver) return;

  // Minimal payload — only what renderer needs
  const pArr = Object.values(players).map(p => [
    p.id, p.x|0, p.y|0,           // id, pos (integer)
    +(p.angle.toFixed(2)),          // angle (2dp)
    p.health|0, p.maxHealth,
    p.alive ? 1 : 0,
    p.kills, p.ammo, p.maxAmmo,
    p.reloading ? 1 : 0,
    p.name, p.character, p.color
  ]);

  const bArr = Object.values(bullets).map(b => [
    b.x|0, b.y|0, b.angle.toFixed(2), b.size, b.color
  ]);

  io.emit('gs', { p: pArr, b: bArr });   // short key = less bytes
}, 1000 / BROADCAST_HZ);

// ─── SOCKET EVENTS ───────────────────────────
io.on('connection', socket => {
  console.log(`[+] ${socket.id}`);

  socket.emit('map_data', { walls: WALLS, width: MAP_W, height: MAP_H });

  socket.on('join', ({ name, character }) => {
    if (!CHARACTERS[character]) return;
    const ch = CHARACTERS[character];
    const sp = randomSpawn();
    players[socket.id] = {
      id: socket.id, name: name || 'Player', character,
      color: ch.color,
      x: sp.x, y: sp.y,
      vx: 0, vy: 0,           // velocity inputs from client
      angle: 0,
      health: ch.maxHealth, maxHealth: ch.maxHealth,
      speed: ch.speed,
      damage: ch.damage, reloadTime: ch.reloadTime,
      maxAmmo: ch.maxAmmo, ammo: ch.maxAmmo,
      bulletSize: ch.bulletSize, fireRate: ch.fireRate,
      lastShot: 0, alive: true, kills: 0, reloading: false
    };
    console.log(`  > ${name} / ${character}`);
    socket.emit('joined', { id: socket.id });
    io.emit('player_joined', { name, character });
  });

  // Client sends velocity direction (normalized dx/dy) + aim angle
  // This is lag-tolerant: even if packet is late, server keeps moving the player
  socket.on('mv', ({ vx, vy, angle }) => {
    const p = players[socket.id];
    if (!p || !p.alive) return;
    // Clamp velocity to player speed
    const len = Math.sqrt(vx*vx + vy*vy);
    if (len > 1.01) {
      p.vx = (vx / len) * p.speed;
      p.vy = (vy / len) * p.speed;
    } else {
      p.vx = vx * p.speed;
      p.vy = vy * p.speed;
    }
    p.angle = angle;
  });

  socket.on('shoot', () => {
    const p = players[socket.id];
    if (!p || !p.alive || p.reloading || p.ammo <= 0) return;
    const now = Date.now();
    if (now - p.lastShot < p.fireRate) return;
    p.lastShot = now;
    p.ammo--;

    const isChesney = p.character === 'Chesney';
    const pellets   = isChesney ? 5 : 1;
    const spread    = isChesney ? 0.28 : 0;

    for (let i = 0; i < pellets; i++) {
      const a = p.angle + (Math.random() - 0.5) * spread;
      bullets[bulletId++] = {
        id: bulletId, ownerId: socket.id,
        x: p.x + Math.cos(p.angle)*20,
        y: p.y + Math.sin(p.angle)*20,
        angle: a,
        damage: isChesney ? p.damage / pellets : p.damage,
        size: p.bulletSize, color: p.color, dist: 0
      };
    }
    if (p.ammo <= 0) doReload(socket.id);
  });

  socket.on('reload', () => {
    const p = players[socket.id];
    if (!p || p.reloading || p.ammo >= p.maxAmmo) return;
    doReload(socket.id);
  });

  socket.on('new_game', () => {
    if (!gameOver) return;
    gameOver = false; winner = null; bullets = {};
    for (const id in players) {
      const sp = randomSpawn();
      Object.assign(players[id], { x:sp.x, y:sp.y, health:players[id].maxHealth, alive:true, kills:0, ammo:players[id].maxAmmo, reloading:false, vx:0, vy:0 });
    }
    io.emit('game_reset');
  });

  socket.on('disconnect', () => {
    const p = players[socket.id];
    if (p) io.emit('player_left', { name: p.name });
    delete players[socket.id];
  });
});

function doReload(id) {
  const p = players[id];
  if (!p) return;
  p.reloading = true;
  setTimeout(() => {
    if (players[id]) { players[id].ammo = players[id].maxAmmo; players[id].reloading = false; }
  }, p.reloadTime);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`\n🎮 CE Strike → http://localhost:${PORT}\n`));
