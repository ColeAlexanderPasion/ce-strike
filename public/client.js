/**
 * CE Strike - Client v3
 * Full 2D sprites + Web Audio + Mobile Touch Controls
 */

// ══════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════
const PLAYER_RADIUS = 14;
const WINS_REQUIRED = 15;
const CHARACTERS_LOCAL = {
  Andree:  { color:'#00e5ff', bodyColor:'#005f7a', weapon:'Assault Rifle', hp:100, spd:3.5, dmg:22, maxAmmo:12, reloadTime:1200 },
  Chesney: { color:'#ff6b35', bodyColor:'#7a2a00', weapon:'Shotgun',       hp:140, spd:2.6, dmg:45, maxAmmo:6,  reloadTime:2200 },
  Denver:  { color:'#b5ff4d', bodyColor:'#3a5500', weapon:'SMG',           hp:80,  spd:4.5, dmg:15, maxAmmo:20, reloadTime:800  },
  Fishcer: { color:'#e040fb', bodyColor:'#5a0070', weapon:'Sniper',        hp:90,  spd:3.0, dmg:70, maxAmmo:5,  reloadTime:2500 },
  Maybelle:{ color:'#ffeb3b', bodyColor:'#7a6000', weapon:'Revolver',      hp:110, spd:3.2, dmg:30, maxAmmo:8,  reloadTime:1500 }
};

// Detect mobile
const IS_MOBILE = /Android|iPhone|iPad|iPod|Touch/i.test(navigator.userAgent) || window.matchMedia('(pointer:coarse)').matches;

// ══════════════════════════════════════════════
// WEB AUDIO ENGINE
// ══════════════════════════════════════════════
let audioCtx = null;
let soundEnabled = true;
let masterGain = null;

function initAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.35;
    masterGain.connect(audioCtx.destination);
    startAmbientMusic();
  } catch(e) {}
}

function playSound(type, options = {}) {
  if (!soundEnabled || !audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const vol = options.volume !== undefined ? options.volume : 1.0;
  try {
    switch(type) {
      case 'shoot_rifle':    synthShoot(80, 0.08, 'sawtooth', vol, 0.05); break;
      case 'shoot_shotgun':  synthShotgun(vol); break;
      case 'shoot_smg':      synthShoot(120, 0.05, 'square', vol * 0.7, 0.03); break;
      case 'shoot_sniper':   synthSniper(vol); break;
      case 'shoot_revolver': synthShoot(60, 0.12, 'sawtooth', vol, 0.08); break;
      case 'reload':         synthReload(vol); break;
      case 'hit':            synthHit(vol); break;
      case 'kill':           synthKill(vol); break;
      case 'death':          synthDeath(vol); break;
      case 'respawn':        synthRespawn(vol); break;
      case 'empty_gun':      synthEmpty(vol); break;
      case 'step':           synthStep(vol); break;
    }
  } catch(e) {}
}

function synthShoot(freq, dur, wave, vol, decay) {
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const noise = createNoise(dur * 0.8);
  const g = audioCtx.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.3, t + dur);
  g.gain.setValueAtTime(vol * 0.7, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g); noise.connect(g); g.connect(masterGain);
  osc.start(t); osc.stop(t + dur);
}

function synthShotgun(vol) {
  for (let i = 0; i < 4; i++) {
    const t = audioCtx.currentTime + i * 0.012;
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.15, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let j = 0; j < data.length; j++) data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (data.length * 0.15));
    const src = audioCtx.createBufferSource();
    const g = audioCtx.createGain();
    const filt = audioCtx.createBiquadFilter();
    filt.type = 'bandpass'; filt.frequency.value = 180 - i * 20;
    src.buffer = buf;
    g.gain.setValueAtTime(vol * 0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    src.connect(filt); filt.connect(g); g.connect(masterGain);
    src.start(t);
  }
}

function synthSniper(vol) {
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  const filt = audioCtx.createBiquadFilter();
  filt.type = 'highpass'; filt.frequency.value = 400;
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(200, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.3);
  g.gain.setValueAtTime(vol * 1.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  osc.connect(filt); filt.connect(g); g.connect(masterGain);
  osc.start(t); osc.stop(t + 0.35);
  const noise = createNoise(0.08);
  const ng = audioCtx.createGain();
  ng.gain.setValueAtTime(vol * 0.5, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  noise.connect(ng); ng.connect(masterGain);
}

function createNoise(dur) {
  const len = Math.max(1, Math.floor(audioCtx.sampleRate * dur));
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.start(audioCtx.currentTime);
  return src;
}

function synthReload(vol) {
  const t = audioCtx.currentTime;
  [0, 0.15, 0.35].forEach((delay, i) => {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'square'; osc.frequency.value = 350 + i * 120;
    g.gain.setValueAtTime(vol * 0.3, t + delay);
    g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.06);
    osc.connect(g); g.connect(masterGain);
    osc.start(t + delay); osc.stop(t + delay + 0.07);
  });
}

function synthHit(vol) {
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(300, t);
  osc.frequency.exponentialRampToValueAtTime(80, t + 0.12);
  g.gain.setValueAtTime(vol * 0.8, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  osc.connect(g); g.connect(masterGain);
  osc.start(t); osc.stop(t + 0.15);
}

function synthKill(vol) {
  const t = audioCtx.currentTime;
  [0, 0.1, 0.2, 0.32].forEach((delay, i) => {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'square';
    const freqs = [330, 440, 554, 660];
    osc.frequency.value = freqs[i];
    g.gain.setValueAtTime(vol * 0.4, t + delay);
    g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.18);
    osc.connect(g); g.connect(masterGain);
    osc.start(t + delay); osc.stop(t + delay + 0.2);
  });
}

function synthDeath(vol) {
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(220, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.8);
  g.gain.setValueAtTime(vol * 0.6, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
  osc.connect(g); g.connect(masterGain);
  osc.start(t); osc.stop(t + 0.9);
}

function synthRespawn(vol) {
  const t = audioCtx.currentTime;
  [0, 0.08, 0.16].forEach((delay, i) => {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine'; osc.frequency.value = 440 + i * 220;
    g.gain.setValueAtTime(vol * 0.5, t + delay);
    g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.1);
    osc.connect(g); g.connect(masterGain);
    osc.start(t + delay); osc.stop(t + delay + 0.12);
  });
}

function synthEmpty(vol) {
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'square'; osc.frequency.value = 200;
  g.gain.setValueAtTime(vol * 0.3, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  osc.connect(g); g.connect(masterGain);
  osc.start(t); osc.stop(t + 0.05);
}

function synthStep(vol) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const buf = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * 0.04), audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.3));
  const src = audioCtx.createBufferSource();
  const g = audioCtx.createGain();
  const filt = audioCtx.createBiquadFilter();
  filt.type = 'lowpass'; filt.frequency.value = 300;
  src.buffer = buf; g.gain.value = vol * 0.08;
  src.connect(filt); filt.connect(g); g.connect(masterGain);
  src.start(t);
}

let ambientInterval = null;
function startAmbientMusic() {
  if (!audioCtx) return;
  const notes = [110, 138, 146, 165, 184, 196, 220, 246];
  let beat = 0;
  ambientInterval = setInterval(() => {
    if (!soundEnabled || !audioCtx) return;
    const t = audioCtx.currentTime;
    const freq = notes[beat % notes.length];
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = beat % 4 === 0 ? 'sawtooth' : 'square';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(g); g.connect(masterGain);
    osc.start(t); osc.stop(t + 0.2);
    if (beat % 4 === 0) {
      const bass = audioCtx.createOscillator();
      const bg = audioCtx.createGain();
      bass.type = 'sawtooth'; bass.frequency.value = freq / 2;
      bg.gain.setValueAtTime(0.08, t);
      bg.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      bass.connect(bg); bg.connect(masterGain);
      bass.start(t); bass.stop(t + 0.4);
    }
    beat++;
  }, 220);
}

document.getElementById('sound-toggle').addEventListener('click', () => {
  initAudio();
  soundEnabled = !soundEnabled;
  if (masterGain) masterGain.gain.value = soundEnabled ? 0.35 : 0;
  document.getElementById('sound-toggle').textContent = soundEnabled ? '🔊 SFX' : '🔇 OFF';
});

// ══════════════════════════════════════════════
// GAME STATE
// ══════════════════════════════════════════════
const socket = io();
let serverPlayers = [];
let serverBullets = [];
let walls = [];
let mapWidth = 1200, mapHeight = 800;
let myId = null, myCharacter = null, myName = 'Player';
let camX = 0, camY = 0;

// Desktop input
const keys = {};
let mouseX = 0, mouseY = 0;
let shootInterval = null;

// Mobile touch input state
const touch = {
  joystickActive: false,
  joystickId: null,
  joystickOriginX: 0,
  joystickOriginY: 0,
  joystickDX: 0,   // -1 to 1
  joystickDY: 0,
  aimAngle: 0,     // radians, updated by right side drag
  aimTouchId: null,
  aimLastX: 0,
  aimLastY: 0,
  isFiring: false,
  fireInterval: null,
};

// Effects
let particles = [];
let muzzleFlashes = [];
let screenShake = 0;
let prevHealth = 100;
let respawnTimer = null;
let reloadStartTime = 0;
let reloadDuration = 0;
let stepTimer = 0;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const miniCanvas = document.getElementById('minimap');
const miniCtx = miniCanvas.getContext('2d');
let viewW = window.innerWidth, viewH = window.innerHeight;
const FONT = '"Press Start 2P", monospace';

// ══════════════════════════════════════════════
// LOBBY BUILD
// ══════════════════════════════════════════════
const lobbyEl = document.getElementById('lobby');
const nameInput = document.getElementById('player-name');
const btnPlay   = document.getElementById('btn-play');
let selectedChar = null;

Object.entries(CHARACTERS_LOCAL).forEach(([key, ch]) => {
  const card = document.createElement('div');
  card.className = 'char-card';

  const previewCanvas = document.createElement('canvas');
  previewCanvas.className = 'char-preview';
  previewCanvas.width = 48; previewCanvas.height = 48;
  drawCharacterPreview(previewCanvas, ch);

  const hpPct  = Math.round((ch.hp  / 140) * 100);
  const spdPct = Math.round((ch.spd / 4.5) * 100);
  const dmgPct = Math.round((ch.dmg / 70)  * 100);

  card.appendChild(previewCanvas);
  card.innerHTML += `
    <div class="char-name" style="color:${ch.color}">${key.toUpperCase()}</div>
    <div class="char-weapon">${ch.weapon}</div>
    <div class="stat-row"><span class="stat-label">HP</span><div class="stat-bar"><div class="stat-fill" style="width:${hpPct}%;background:#00e676"></div></div></div>
    <div class="stat-row"><span class="stat-label">SPD</span><div class="stat-bar"><div class="stat-fill" style="width:${spdPct}%;background:#00e5ff"></div></div></div>
    <div class="stat-row"><span class="stat-label">DMG</span><div class="stat-bar"><div class="stat-fill" style="width:${dmgPct}%;background:#ff6b35"></div></div></div>
  `;

  card.addEventListener('click', () => {
    initAudio();
    document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    selectedChar = key;
    checkReady();
  });
  document.getElementById('char-grid').appendChild(card);
});

function drawCharacterPreview(cvs, ch) {
  const c = cvs.getContext('2d');
  c.imageSmoothingEnabled = false;
  const cx = 24, cy = 24;
  c.fillStyle = 'rgba(0,0,0,0.3)';
  c.beginPath(); c.ellipse(cx, cy+12, 10, 5, 0, 0, Math.PI*2); c.fill();
  c.fillStyle = ch.bodyColor;
  c.fillRect(cx-8, cy+2, 6, 10);
  c.fillRect(cx+2, cy+2, 6, 10);
  c.fillRect(cx-9, cy-8, 18, 14);
  c.fillStyle = ch.color + 'aa';
  c.fillRect(cx-6, cy-6, 12, 8);
  c.fillStyle = ch.color;
  c.fillRect(cx-6, cy-18, 12, 12);
  c.fillStyle = '#000';
  c.fillRect(cx-4, cy-15, 3, 3);
  c.fillRect(cx+1,  cy-15, 3, 3);
  c.fillStyle = '#fff';
  c.fillRect(cx-3, cy-14, 2, 2);
  c.fillRect(cx+2,  cy-14, 2, 2);
  c.fillStyle = '#888';
  c.fillRect(cx+8, cy-4, 14, 4);
  c.fillRect(cx+20, cy-6, 3, 8);
}

nameInput.addEventListener('input', checkReady);
function checkReady() { btnPlay.disabled = !(nameInput.value.trim() && selectedChar); }

btnPlay.addEventListener('click', () => {
  initAudio();
  myName = nameInput.value.trim() || 'Player';
  myCharacter = selectedChar;
  socket.emit('join', { name: myName, character: myCharacter });
});

// ══════════════════════════════════════════════
// SOCKET EVENTS
// ══════════════════════════════════════════════
socket.on('map_data', d => { walls = d.walls; mapWidth = d.width; mapHeight = d.height; });
socket.on('joined', d => { myId = d.id; startGame(); });

socket.on('game_state', state => {
  serverPlayers = state.players;
  serverBullets  = state.bullets;

  const me = serverPlayers.find(p => p.id === myId);
  if (me) {
    if (me.health < prevHealth && me.health > 0) {
      flashDamage(1 - me.health / me.maxHealth);
      screenShake = Math.max(screenShake, 5 * (1 - me.health / me.maxHealth) + 2);
      playSound('hit', { volume: 0.8 });
    }
    if (!me.alive && prevHealth > 0) {
      playSound('death', { volume: 1.0 });
      document.getElementById('death-screen').classList.add('visible');
      startDeathCountdown();
      // Stop mobile fire
      touch.isFiring = false;
      clearInterval(touch.fireInterval);
    }
    prevHealth = me.health;
    updateReloadBar(me);
  }
  updateHUD();
});

socket.on('kill_feed', ({ killer, victim, killerChar }) => {
  addKillFeed(killer, victim, killerChar);
  if (killer === myName) playSound('kill', { volume: 1.0 });
});

socket.on('player_respawn', ({ id }) => {
  if (id === myId) {
    document.getElementById('death-screen').classList.remove('visible');
    if (respawnTimer) clearInterval(respawnTimer);
    const me = serverPlayers.find(p => p.id === myId);
    prevHealth = me?.maxHealth || 100;
    playSound('respawn', { volume: 0.9 });
    if (me) spawnParticles(me.x, me.y, '#00e5ff', 12, 'spark');
  }
});

socket.on('game_over', ({ winner, character }) => {
  document.getElementById('go-winner-text').textContent = `🏆 ${winner} WINS!`;
  document.getElementById('go-winner-text').style.color = CHARACTERS_LOCAL[character]?.color || '#ffeb3b';
  document.getElementById('go-sub').textContent = `reached ${WINS_REQUIRED} kills`;
  document.getElementById('game-over-screen').classList.add('visible');
  playSound('kill', { volume: 1.0 });
  touch.isFiring = false;
  clearInterval(touch.fireInterval);
});

socket.on('game_reset', () => {
  document.getElementById('game-over-screen').classList.remove('visible');
  document.getElementById('death-screen').classList.remove('visible');
  particles = []; muzzleFlashes = [];
});

document.getElementById('btn-new-game').addEventListener('click', () => socket.emit('new_game'));

// ══════════════════════════════════════════════
// START GAME
// ══════════════════════════════════════════════
function startGame() {
  lobbyEl.style.display = 'none';
  canvas.style.display = 'block';
  document.getElementById('hud').style.display = 'block';
  document.getElementById('minimap').style.display = 'block';

  // Show mobile controls on touch devices
  if (IS_MOBILE) {
    document.getElementById('mobile-controls').style.display = 'block';
    setupMobileControls();
  }

  resizeCanvas();
  setupDesktopInput();
  requestAnimationFrame(gameLoop);

  const ch = CHARACTERS_LOCAL[myCharacter];
  if (ch) {
    document.getElementById('char-name-hud').textContent = myCharacter.toUpperCase();
    document.getElementById('char-name-hud').style.color = ch.color;
    document.getElementById('weapon-name-hud').textContent = ch.weapon;
  }
}

function resizeCanvas() {
  viewW = canvas.width  = window.innerWidth;
  viewH = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);

// ══════════════════════════════════════════════
// DESKTOP INPUT
// ══════════════════════════════════════════════
function setupDesktopInput() {
  document.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (e.key.toLowerCase() === 'r') triggerReload();
    e.preventDefault();
  });
  document.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

  canvas.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });

  canvas.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    initAudio();
    fireBullet();
    shootInterval = setInterval(fireBullet, 80);
  });
  canvas.addEventListener('mouseup', e => {
    if (e.button === 0) clearInterval(shootInterval);
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
}

function triggerReload() {
  const me = serverPlayers.find(p => p.id === myId);
  if (!me || me.reloading || me.ammo >= me.maxAmmo) return;
  socket.emit('reload');
  playSound('reload', { volume: 0.8 });
  reloadDuration = CHARACTERS_LOCAL[myCharacter]?.reloadTime || 1500;
  reloadStartTime = performance.now();
}

function fireBullet() {
  const me = serverPlayers.find(p => p.id === myId);
  if (!me || !me.alive) return;
  if (me.ammo <= 0) { playSound('empty_gun', { volume: 0.6 }); return; }
  if (me.reloading) return;

  socket.emit('shoot');

  // Compute angle — mobile uses touch.aimAngle, desktop uses mouse
  let angle;
  if (IS_MOBILE) {
    angle = touch.aimAngle;
  } else {
    const worldMx = mouseX + camX, worldMy = mouseY + camY;
    angle = Math.atan2(worldMy - me.y, worldMx - me.x);
  }

  muzzleFlashes.push({
    x: me.x + Math.cos(angle)*22,
    y: me.y + Math.sin(angle)*22,
    angle, life: 6,
    color: CHARACTERS_LOCAL[myCharacter]?.color || '#fff'
  });

  const perpAngle = angle + Math.PI/2 + (Math.random()-0.5)*0.3;
  particles.push({ x: me.x, y: me.y, vx: Math.cos(perpAngle)*2, vy: Math.sin(perpAngle)*2 - 1, life: 40, maxLife: 40, color: '#c8a000', size: 2, type: 'shell' });

  screenShake = Math.max(screenShake, 2);

  const weaponMap = { Andree:'shoot_rifle', Chesney:'shoot_shotgun', Denver:'shoot_smg', Fishcer:'shoot_sniper', Maybelle:'shoot_revolver' };
  playSound(weaponMap[myCharacter] || 'shoot_rifle', { volume: 0.9 });
}

// ══════════════════════════════════════════════
// MOBILE TOUCH CONTROLS
// ══════════════════════════════════════════════
function setupMobileControls() {
  const joystickZone = document.getElementById('joystick-zone');
  const joystickKnob = document.getElementById('joystick-knob');
  const aimZone      = document.getElementById('aim-zone');
  const btnShoot     = document.getElementById('btn-shoot');
  const btnReloadM   = document.getElementById('btn-reload-mobile');

  const JOYSTICK_RADIUS = 50;

  // ── JOYSTICK ──
  joystickZone.addEventListener('touchstart', e => {
    e.preventDefault();
    initAudio();
    const t = e.changedTouches[0];
    const rect = joystickZone.getBoundingClientRect();
    touch.joystickActive = true;
    touch.joystickId = t.identifier;
    touch.joystickOriginX = rect.left + rect.width / 2;
    touch.joystickOriginY = rect.top  + rect.height / 2;
    updateJoystick(t.clientX, t.clientY);
  }, { passive: false });

  joystickZone.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === touch.joystickId) updateJoystick(t.clientX, t.clientY);
    }
  }, { passive: false });

  joystickZone.addEventListener('touchend', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === touch.joystickId) {
        touch.joystickActive = false;
        touch.joystickDX = 0;
        touch.joystickDY = 0;
        joystickKnob.style.transform = 'translate(-50%, -50%)';
      }
    }
  }, { passive: false });

  function updateJoystick(cx, cy) {
    let dx = cx - touch.joystickOriginX;
    let dy = cy - touch.joystickOriginY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > JOYSTICK_RADIUS) {
      dx = (dx / dist) * JOYSTICK_RADIUS;
      dy = (dy / dist) * JOYSTICK_RADIUS;
    }
    touch.joystickDX = dx / JOYSTICK_RADIUS;
    touch.joystickDY = dy / JOYSTICK_RADIUS;
    joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  // ── AIM ZONE (right half of screen – drag to rotate aim angle) ──
  aimZone.addEventListener('touchstart', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (touch.aimTouchId === null) {
        touch.aimTouchId = t.identifier;
        touch.aimLastX = t.clientX;
        touch.aimLastY = t.clientY;
      }
    }
  }, { passive: false });

  aimZone.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === touch.aimTouchId) {
        const dx = t.clientX - touch.aimLastX;
        // Rotate aim by drag delta — sensitivity tuned for thumb comfort
        touch.aimAngle += dx * 0.018;
        touch.aimLastX = t.clientX;
        touch.aimLastY = t.clientY;

        // Also update the virtual "mouse" position for server angle calculation
        const me = serverPlayers.find(p => p.id === myId);
        if (me) {
          mouseX = (me.x - camX) + Math.cos(touch.aimAngle) * 200;
          mouseY = (me.y - camY) + Math.sin(touch.aimAngle) * 200;
        }
      }
    }
  }, { passive: false });

  aimZone.addEventListener('touchend', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === touch.aimTouchId) touch.aimTouchId = null;
    }
  }, { passive: false });

  // ── SHOOT BUTTON ──
  btnShoot.addEventListener('touchstart', e => {
    e.preventDefault();
    initAudio();
    touch.isFiring = true;
    btnShoot.classList.add('firing');
    fireBullet();
    touch.fireInterval = setInterval(fireBullet, 100);
  }, { passive: false });

  btnShoot.addEventListener('touchend', e => {
    e.preventDefault();
    touch.isFiring = false;
    btnShoot.classList.remove('firing');
    clearInterval(touch.fireInterval);
  }, { passive: false });

  // Prevent accidental double-fire if finger slides off
  btnShoot.addEventListener('touchcancel', e => {
    touch.isFiring = false;
    btnShoot.classList.remove('firing');
    clearInterval(touch.fireInterval);
  });

  // ── RELOAD BUTTON ──
  btnReloadM.addEventListener('touchstart', e => {
    e.preventDefault();
    initAudio();
    triggerReload();
  }, { passive: false });

  // Prevent scrolling/zooming during gameplay on mobile
  document.addEventListener('touchmove', e => { if (e.target === canvas) e.preventDefault(); }, { passive: false });
}

// ══════════════════════════════════════════════
// MOVEMENT
// ══════════════════════════════════════════════
let lastSentPos = { x: -999, y: -999 };
let stepTimer2 = 0;

function sendMovement() {
  const me = serverPlayers.find(p => p.id === myId);
  if (!me || !me.alive) return;

  const spd = me.speed || 3;
  let dx = 0, dy = 0;

  if (IS_MOBILE && touch.joystickActive) {
    // Mobile joystick
    dx = touch.joystickDX * spd;
    dy = touch.joystickDY * spd;
  } else {
    // Desktop keyboard
    if (keys['w'] || keys['arrowup'])    dy -= spd;
    if (keys['s'] || keys['arrowdown'])  dy += spd;
    if (keys['a'] || keys['arrowleft'])  dx -= spd;
    if (keys['d'] || keys['arrowright']) dx += spd;
    if (dx && dy) { dx *= 0.707; dy *= 0.707; }
  }

  // Footsteps & dust
  if (dx || dy) {
    stepTimer2--;
    if (stepTimer2 <= 0) { playSound('step', { volume: 0.1 }); stepTimer2 = 20; }
    if (Math.random() < 0.12) {
      particles.push({ x: me.x + (Math.random()-0.5)*8, y: me.y + 12, vx: (Math.random()-0.5)*0.5, vy: -0.3, life: 20, maxLife: 20, color: '#2a2a2a', size: 2, type: 'dust' });
    }
  }

  // Determine aim angle
  let angle;
  if (IS_MOBILE) {
    angle = touch.aimAngle;
  } else {
    const wx = mouseX + camX, wy = mouseY + camY;
    angle = Math.atan2(wy - me.y, wx - me.x);
  }

  socket.emit('player_move', { x: me.x + dx, y: me.y + dy, angle });
}

// ══════════════════════════════════════════════
// PARTICLES
// ══════════════════════════════════════════════
function spawnParticles(x, y, color, count, type) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i / count) + Math.random() * 0.5;
    const speed = 1.5 + Math.random() * 3;
    particles.push({ x, y, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed, life: 30 + Math.floor(Math.random()*20), maxLife: 50, color, size: type === 'blood' ? 3 + Math.random()*3 : 2 + Math.random()*2, type });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.92; p.vy *= 0.92;
    if (p.type !== 'shell') p.vy += 0.04;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = muzzleFlashes.length - 1; i >= 0; i--) {
    muzzleFlashes[i].life--;
    if (muzzleFlashes[i].life <= 0) muzzleFlashes.splice(i, 1);
  }
}

// ══════════════════════════════════════════════
// HUD
// ══════════════════════════════════════════════
function updateHUD() {
  const me = serverPlayers.find(p => p.id === myId);
  if (!me) return;

  const hpPct = Math.max(0, (me.health / me.maxHealth) * 100);
  document.getElementById('health-bar').style.width = hpPct + '%';
  document.getElementById('health-bar').style.background =
    hpPct > 50 ? 'linear-gradient(90deg,#00e676,#69f0ae)' :
    hpPct > 25 ? 'linear-gradient(90deg,#ffeb3b,#ffd740)' :
                 'linear-gradient(90deg,#ff1744,#ff6b35)';
  document.getElementById('health-val').textContent = Math.ceil(me.health);
  document.getElementById('ammo-val').textContent = me.ammo;
  document.getElementById('ammo-val').style.color = me.ammo === 0 ? '#ff1744' : me.ammo <= 3 ? '#ff6b35' : '#ffeb3b';
  document.getElementById('ammo-max').textContent = '/ ' + me.maxAmmo;
  document.getElementById('my-kills').textContent = me.kills;
  updateScoreboard();
}

function updateReloadBar(me) {
  const wrap = document.getElementById('reload-bar-wrap');
  const inner = document.getElementById('reload-bar-inner');
  if (me.reloading) {
    wrap.style.display = 'flex';
    if (reloadDuration > 0) {
      const pct = Math.min(100, ((performance.now() - reloadStartTime) / reloadDuration) * 100);
      inner.style.width = pct + '%';
    }
  } else {
    wrap.style.display = 'none';
    inner.style.width = '0%';
  }
}

function updateScoreboard() {
  const sorted = [...serverPlayers].sort((a,b) => b.kills - a.kills);
  document.getElementById('sb-rows').innerHTML = sorted.map(p => {
    const isMe = p.id === myId;
    const ch = CHARACTERS_LOCAL[p.character];
    const c = ch ? ch.color : '#fff';
    return `<div class="sb-row">
      <div class="sb-dot" style="background:${c}"></div>
      <span class="sb-name" style="color:${isMe ? c : '#777'}">${isMe ? '►' : ''}${p.name}</span>
      <span class="sb-kills">${p.kills}</span>
    </div>`;
  }).join('');
}

function addKillFeed(killer, victim, killerChar) {
  const feed = document.getElementById('kill-feed');
  const el = document.createElement('div');
  el.className = 'kf-entry';
  const color = CHARACTERS_LOCAL[killerChar]?.color || '#fff';
  el.style.borderLeftColor = color;
  el.innerHTML = `<span style="color:${color}">${killer}</span> <span style="color:#555">✦</span> ${victim}`;
  feed.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function flashDamage(intensity) {
  const el = document.getElementById('damage-flash');
  el.style.background = `rgba(255,0,0,${Math.min(0.45, intensity * 0.5)})`;
  setTimeout(() => { el.style.background = 'rgba(255,0,0,0)'; }, 120);
}

function startDeathCountdown() {
  let count = 3;
  document.getElementById('respawn-countdown').textContent = count;
  if (respawnTimer) clearInterval(respawnTimer);
  respawnTimer = setInterval(() => {
    count--;
    if (count <= 0) { clearInterval(respawnTimer); return; }
    document.getElementById('respawn-countdown').textContent = count;
  }, 1000);
}

// ══════════════════════════════════════════════
// CAMERA
// ══════════════════════════════════════════════
function updateCamera() {
  const me = serverPlayers.find(p => p.id === myId);
  if (!me) return;

  let leadX = 0, leadY = 0;
  if (!IS_MOBILE) {
    leadX = (mouseX - viewW/2) * 0.08;
    leadY = (mouseY - viewH/2) * 0.08;
  } else {
    // On mobile, lead toward aim direction
    leadX = Math.cos(touch.aimAngle) * 60;
    leadY = Math.sin(touch.aimAngle) * 60;
  }

  const targetX = me.x - viewW/2 + leadX;
  const targetY = me.y - viewH/2 + leadY;
  camX += (targetX - camX) * 0.1;
  camY += (targetY - camY) * 0.1;
  camX = Math.max(0, Math.min(camX, mapWidth  - viewW));
  camY = Math.max(0, Math.min(camY, mapHeight - viewH));

  if (screenShake > 0) {
    camX += (Math.random()-0.5) * screenShake;
    camY += (Math.random()-0.5) * screenShake;
    screenShake *= 0.75;
    if (screenShake < 0.1) screenShake = 0;
  }
}

// ══════════════════════════════════════════════
// RENDERING
// ══════════════════════════════════════════════
function drawFloor() {
  ctx.fillStyle = '#0c0c18';
  ctx.fillRect(0, 0, viewW, viewH);

  const gridSize = 48;
  const offX = ((-camX % gridSize) + gridSize) % gridSize;
  const offY = ((-camY % gridSize) + gridSize) % gridSize;

  for (let gx = offX - gridSize; gx < viewW + gridSize; gx += gridSize) {
    for (let gy = offY - gridSize; gy < viewH + gridSize; gy += gridSize) {
      const tileX = Math.floor((gx - offX + camX) / gridSize);
      const tileY = Math.floor((gy - offY + camY) / gridSize);
      ctx.fillStyle = (tileX + tileY) % 2 === 0 ? '#0e0e1c' : '#0a0a14';
      ctx.fillRect(gx, gy, gridSize, gridSize);
    }
  }
  ctx.strokeStyle = '#14142a'; ctx.lineWidth = 1;
  for (let x = offX; x < viewW; x += gridSize) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, viewH); ctx.stroke(); }
  for (let y = offY; y < viewH; y += gridSize) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(viewW, y); ctx.stroke(); }
}

function drawWalls() {
  walls.forEach(w => {
    const wx = w.x - camX, wy = w.y - camY;
    ctx.fillStyle = '#18182e';
    ctx.fillRect(wx, wy, w.w, w.h);
    ctx.strokeStyle = '#111126'; ctx.lineWidth = 1;
    const brickH = 12;
    for (let by = wy + brickH; by < wy + w.h; by += brickH) { ctx.beginPath(); ctx.moveTo(wx, by); ctx.lineTo(wx + w.w, by); ctx.stroke(); }
    ctx.fillStyle = '#2a2a4a';
    ctx.fillRect(wx, wy, w.w, 4);
    ctx.fillRect(wx, wy, 4, w.h);
    ctx.fillStyle = '#08081a';
    ctx.fillRect(wx, wy + w.h - 3, w.w, 3);
    ctx.fillRect(wx + w.w - 3, wy, 3, w.h);
    ctx.strokeStyle = 'rgba(0,229,255,0.05)'; ctx.lineWidth = 1;
    ctx.strokeRect(wx, wy, w.w, w.h);
  });
}

function drawPlayer(p) {
  const sx = p.x - camX, sy = p.y - camY;
  const isMe = p.id === myId;
  const ch = CHARACTERS_LOCAL[p.character];
  const color = ch ? ch.color : '#fff';
  const bodyColor = ch ? ch.bodyColor : '#333';

  if (!p.alive) {
    ctx.globalAlpha = 0.35;
    ctx.save(); ctx.translate(sx, sy);
    ctx.fillStyle = '#300';
    ctx.beginPath(); ctx.ellipse(0, 0, PLAYER_RADIUS, PLAYER_RADIUS * 0.5, 0.4, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#600'; ctx.fillRect(-8, -3, 16, 6);
    ctx.globalAlpha = 1; ctx.restore();
    return;
  }

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath(); ctx.ellipse(sx + 2, sy + 6, PLAYER_RADIUS - 2, PLAYER_RADIUS * 0.4, 0, 0, Math.PI*2); ctx.fill();

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(p.angle);

  // Leg animation
  const legAnim = Math.sin(Date.now() * 0.008 + p.x * 0.1) * 3;
  ctx.fillStyle = bodyColor;
  ctx.fillRect(-7, 4, 6, 10 + legAnim);
  ctx.fillRect(1,  4, 6, 10 - legAnim);
  ctx.fillStyle = '#222';
  ctx.fillRect(-8, 12 + legAnim, 7, 4);
  ctx.fillRect(0,  12 - legAnim, 7, 4);

  // Torso
  ctx.fillStyle = bodyColor;
  ctx.fillRect(-9, -8, 18, 16);
  ctx.fillStyle = color + '55';
  ctx.fillRect(-7, -7, 14, 12);
  ctx.fillStyle = color + 'cc';
  ctx.fillRect(-3, -6, 6, 10);

  // Arms
  ctx.fillStyle = bodyColor;
  ctx.fillRect(-12, -6, 5, 8);
  ctx.fillRect(7,   -6, 5, 8);

  // Head
  ctx.fillStyle = color;
  ctx.fillRect(-6, -18, 12, 12);
  ctx.fillStyle = color + 'aa';
  ctx.fillRect(-6, -18, 12, 4);
  ctx.fillStyle = '#000';
  ctx.fillRect(-4, -15, 3, 3);
  ctx.fillRect(1,  -15, 3, 3);
  ctx.fillStyle = '#fff';
  ctx.fillRect(-3, -14, 2, 2);
  ctx.fillRect(2,  -14, 2, 2);

  // Weapon
  ctx.fillStyle = '#555'; ctx.fillRect(6, -3, 16, 5);
  ctx.fillStyle = '#333'; ctx.fillRect(4, -4, 8, 7);
  ctx.fillStyle = '#777'; ctx.fillRect(20, -4, 4, 7);

  if (isMe) {
    ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    ctx.shadowColor = color; ctx.shadowBlur = 10;
    ctx.strokeRect(-10, -20, 20, 30);
    ctx.shadowBlur = 0;
  }
  ctx.restore();

  // Name tag
  ctx.font = `6px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(sx - 28, sy - PLAYER_RADIUS - 22, 56, 10);
  ctx.fillStyle = isMe ? '#fff' : '#aaa';
  ctx.fillText(p.name, sx, sy - PLAYER_RADIUS - 17);

  // Health bar
  const hw = 36, hx = sx - hw/2, hy = sy - PLAYER_RADIUS - 10;
  const hpPct = p.health / p.maxHealth;
  ctx.fillStyle = '#000'; ctx.fillRect(hx-1, hy-1, hw+2, 7);
  ctx.fillStyle = '#111'; ctx.fillRect(hx, hy, hw, 5);
  ctx.fillStyle = hpPct > 0.5 ? '#00e676' : hpPct > 0.25 ? '#ffeb3b' : '#ff1744';
  ctx.fillRect(hx, hy, hw * hpPct, 5);
}

function drawBullets() {
  serverBullets.forEach(b => {
    const sx = b.x - camX, sy = b.y - camY;
    const s = b.size || 4;
    ctx.shadowColor = b.color; ctx.shadowBlur = 10;
    ctx.fillStyle = '#fff'; ctx.fillRect(sx - s*0.4, sy - s*0.4, s*0.8, s*0.8);
    ctx.fillStyle = b.color; ctx.fillRect(sx - s/2, sy - s/2, s, s);
    ctx.globalAlpha = 0.3;
    ctx.fillRect(sx - s/2 - Math.cos(b.angle||0)*8, sy - s/2 - Math.sin(b.angle||0)*8, s*0.6, s*0.6);
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  });
}

function drawMuzzleFlashes() {
  muzzleFlashes.forEach(mf => {
    const sx = mf.x - camX, sy = mf.y - camY;
    ctx.globalAlpha = mf.life / 6;
    ctx.shadowColor = mf.color; ctx.shadowBlur = 20;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(mf.angle);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(-14, 0); ctx.lineTo(-3, 3); ctx.lineTo(0, 14);
    ctx.lineTo(3, 3); ctx.lineTo(14, 0); ctx.lineTo(3, -3);
    ctx.lineTo(0, -14); ctx.lineTo(-3, -3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = mf.color;
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.fill();
    ctx.restore(); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  });
}

function drawParticles() {
  particles.forEach(p => {
    const alpha = p.life / p.maxLife;
    const sx = p.x - camX, sy = p.y - camY;
    ctx.globalAlpha = alpha;
    if (p.type === 'blood') {
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(sx, sy, p.size * alpha + 0.5, 0, Math.PI*2); ctx.fill();
    } else if (p.type === 'shell') {
      ctx.fillStyle = p.color;
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(p.life * 0.3);
      ctx.fillRect(-p.size, -p.size*0.5, p.size*2, p.size);
      ctx.restore();
    } else if (p.type === 'spark') {
      ctx.shadowColor = p.color; ctx.shadowBlur = 5;
      ctx.fillStyle = p.color;
      ctx.fillRect(sx - p.size/2, sy - p.size/2, p.size, p.size);
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(sx, sy, p.size * alpha, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
}

// Draw mobile aim direction indicator on canvas
function drawMobileAimIndicator() {
  if (!IS_MOBILE) return;
  const me = serverPlayers.find(p => p.id === myId);
  if (!me || !me.alive) return;

  const sx = me.x - camX, sy = me.y - camY;
  const aimDist = 60;
  const ax = sx + Math.cos(touch.aimAngle) * aimDist;
  const ay = sy + Math.sin(touch.aimAngle) * aimDist;

  // Dashed aim line
  ctx.setLineDash([4, 6]);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ax, ay); ctx.stroke();
  ctx.setLineDash([]);

  // Crosshair dot at aim point
  const ch = CHARACTERS_LOCAL[me.character];
  const color = ch ? ch.color : '#fff';
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(ax, ay, 6, 0, Math.PI*2);
  ctx.stroke();
  ctx.globalAlpha = 0.7;
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawCrosshair() {
  // Only show mouse crosshair on desktop
  if (IS_MOBILE) return;
  const me = serverPlayers.find(p => p.id === myId);
  if (!me || !me.alive) return;

  const ch = CHARACTERS_LOCAL[me.character];
  const color = ch ? ch.color : '#fff';
  const cx = mouseX, cy = mouseY;

  ctx.strokeStyle = color + 'aa'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI*2); ctx.stroke();

  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
  const gap = 6, len = 9;
  ctx.beginPath();
  ctx.moveTo(cx-gap-len, cy); ctx.lineTo(cx-gap, cy);
  ctx.moveTo(cx+gap, cy);     ctx.lineTo(cx+gap+len, cy);
  ctx.moveTo(cx, cy-gap-len); ctx.lineTo(cx, cy-gap);
  ctx.moveTo(cx, cy+gap);     ctx.lineTo(cx, cy+gap+len);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.fillRect(cx-2, cy-2, 4, 4);
}

function drawMinimap() {
  const mW = 160, mH = 107;
  const scaleX = mW / mapWidth, scaleY = mH / mapHeight;

  miniCtx.clearRect(0, 0, mW, mH);
  miniCtx.fillStyle = '#060610';
  miniCtx.fillRect(0, 0, mW, mH);

  miniCtx.fillStyle = '#2a2a4a';
  walls.forEach(w => miniCtx.fillRect(w.x*scaleX, w.y*scaleY, Math.max(1,w.w*scaleX), Math.max(1,w.h*scaleY)));

  miniCtx.strokeStyle = 'rgba(255,255,255,0.1)'; miniCtx.lineWidth = 1;
  miniCtx.strokeRect(camX*scaleX, camY*scaleY, viewW*scaleX, viewH*scaleY);

  serverPlayers.forEach(p => {
    if (!p.alive) return;
    const ch = CHARACTERS_LOCAL[p.character];
    miniCtx.fillStyle = p.id === myId ? '#fff' : (ch ? ch.color : '#aaa');
    const ms = p.id === myId ? 4 : 3;
    miniCtx.fillRect(p.x*scaleX - ms/2, p.y*scaleY - ms/2, ms, ms);
  });

  // Aim direction on minimap for mobile
  if (IS_MOBILE) {
    const me = serverPlayers.find(p => p.id === myId);
    if (me && me.alive) {
      miniCtx.strokeStyle = 'rgba(255,255,255,0.4)'; miniCtx.lineWidth = 1;
      miniCtx.beginPath();
      miniCtx.moveTo(me.x*scaleX, me.y*scaleY);
      miniCtx.lineTo(me.x*scaleX + Math.cos(touch.aimAngle)*12, me.y*scaleY + Math.sin(touch.aimAngle)*12);
      miniCtx.stroke();
    }
  }
}

// ══════════════════════════════════════════════
// GAME LOOP
// ══════════════════════════════════════════════
function gameLoop() {
  sendMovement();
  updateCamera();
  updateParticles();
  render();
  requestAnimationFrame(gameLoop);
}

function render() {
  ctx.clearRect(0, 0, viewW, viewH);
  drawFloor();
  drawWalls();
  drawParticles();
  drawBullets();
  drawMuzzleFlashes();
  serverPlayers.filter(p => !p.alive).forEach(drawPlayer);
  serverPlayers.filter(p =>  p.alive).forEach(drawPlayer);
  drawMobileAimIndicator();
  drawCrosshair();
  drawMinimap();
}
