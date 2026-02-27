/**
 * CE Strike - Client v4
 * • Client-side prediction (smooth movement regardless of lag)
 * • Velocity-based input (send direction, not position)
 * • Dual joystick mobile (left=move, right=aim+shoot)
 * • 20Hz server state interpolation for other players
 */

// ═══════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════
const P_RADIUS = 14;
const WINS_REQ = 15;
const CHARS = {
  Andree:  { color:'#00e5ff', bodyColor:'#005f7a', weapon:'Assault Rifle', hp:100, spd:4.2, maxAmmo:12, reloadTime:1200 },
  Chesney: { color:'#ff6b35', bodyColor:'#7a2a00', weapon:'Shotgun',       hp:140, spd:3.2, maxAmmo:6,  reloadTime:2200 },
  Denver:  { color:'#b5ff4d', bodyColor:'#3a5500', weapon:'SMG',           hp:80,  spd:5.2, maxAmmo:20, reloadTime:800  },
  Fishcer: { color:'#e040fb', bodyColor:'#5a0070', weapon:'Sniper',        hp:90,  spd:3.6, maxAmmo:5,  reloadTime:2500 },
  Maybelle:{ color:'#ffeb3b', bodyColor:'#7a6000', weapon:'Revolver',      hp:110, spd:3.9, maxAmmo:8,  reloadTime:1500 }
};
const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.matchMedia('(pointer:coarse)').matches;
const FONT = '"Press Start 2P",monospace';

// ═══════════════════════════════════════
// AUDIO
// ═══════════════════════════════════════
let AC = null, MG = null, soundOn = true;
function initAudio(){
  if(AC) return;
  try{
    AC = new(window.AudioContext||window.webkitAudioContext)();
    MG = AC.createGain(); MG.gain.value = 0.35; MG.connect(AC.destination);
    startMusic();
  }catch(e){}
}
function playSound(t,vol=1){
  if(!soundOn||!AC) return;
  if(AC.state==='suspended') AC.resume();
  try{
    const v = vol*0.9;
    if(t==='shoot_rifle')    { sOsc(80,0.08,'sawtooth',v); sNoise(0.06,v*0.4); }
    else if(t==='shoot_shotgun') sShotgun(v);
    else if(t==='shoot_smg') { sOsc(120,0.05,'square',v*0.7); }
    else if(t==='shoot_sniper') sSniper(v);
    else if(t==='shoot_revolver') { sOsc(60,0.12,'sawtooth',v); }
    else if(t==='reload')    { [0,.15,.35].forEach((d,i)=>sOsc2(350+i*120,d,0.06,v)); }
    else if(t==='hit')       { sOsc(300,0.12,'sine',v,true); }
    else if(t==='kill')      { [0,.1,.2,.32].forEach((d,i)=>sOsc2([330,440,554,660][i],d,0.18,v*0.4,'square')); }
    else if(t==='death')     { sOsc(220,0.8,'sawtooth',v*0.6,true); }
    else if(t==='respawn')   { [0,.08,.16].forEach((d,i)=>sOsc2(440+i*220,d,0.1,v*0.5,'sine')); }
    else if(t==='empty')     { sOsc2(200,0,0.04,v*0.3,'square'); }
    else if(t==='step')      { sNoise(0.04,v*0.06,300); }
  }catch(e){}
}
function sOsc(freq,dur,type,vol,drop){
  const t=AC.currentTime,o=AC.createOscillator(),g=AC.createGain();
  o.type=type; o.frequency.value=freq;
  if(drop) o.frequency.exponentialRampToValueAtTime(freq*0.25,t+dur);
  g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
  o.connect(g); g.connect(MG); o.start(t); o.stop(t+dur+0.01);
}
function sOsc2(freq,delay,dur,vol,type='square'){
  const t=AC.currentTime+delay,o=AC.createOscillator(),g=AC.createGain();
  o.type=type; o.frequency.value=freq;
  g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
  o.connect(g); g.connect(MG); o.start(t); o.stop(t+dur+0.01);
}
function sNoise(dur,vol,lpFreq=0){
  const len=Math.max(1,AC.sampleRate*dur|0),buf=AC.createBuffer(1,len,AC.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<len;i++) d[i]=Math.random()*2-1;
  const s=AC.createBufferSource(),g=AC.createGain();
  s.buffer=buf; g.gain.value=vol;
  if(lpFreq>0){const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=lpFreq;s.connect(f);f.connect(g);}
  else s.connect(g);
  g.connect(MG); s.start(AC.currentTime);
}
function sShotgun(vol){
  for(let i=0;i<4;i++){
    const t=AC.currentTime+i*0.012;
    const b=AC.createBuffer(1,AC.sampleRate*0.15|0,AC.sampleRate),d=b.getChannelData(0);
    for(let j=0;j<d.length;j++) d[j]=(Math.random()*2-1)*Math.exp(-j/(d.length*0.15));
    const s=AC.createBufferSource(),g=AC.createGain(),f=AC.createBiquadFilter();
    f.type='bandpass';f.frequency.value=170-i*15;s.buffer=b;
    g.gain.setValueAtTime(vol*0.9,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.15);
    s.connect(f);f.connect(g);g.connect(MG);s.start(t);
  }
}
function sSniper(vol){
  const t=AC.currentTime,o=AC.createOscillator(),g=AC.createGain();
  o.type='sawtooth';o.frequency.setValueAtTime(200,t);o.frequency.exponentialRampToValueAtTime(40,t+0.3);
  g.gain.setValueAtTime(vol*1.1,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.3);
  o.connect(g);g.connect(MG);o.start(t);o.stop(t+0.35);
  sNoise(0.08,vol*0.4);
}
let musicTimer=null;
function startMusic(){
  const notes=[110,138,146,165,184,196,220,246]; let beat=0;
  musicTimer=setInterval(()=>{
    if(!soundOn||!AC) return;
    const f=notes[beat%notes.length],t=AC.currentTime;
    sOsc2(f,0,0.18,0.045,beat%4===0?'sawtooth':'square');
    if(beat%4===0) sOsc2(f/2,0,0.38,0.08,'sawtooth');
    beat++;
  },220);
}
document.getElementById('stog').addEventListener('click',()=>{
  initAudio(); soundOn=!soundOn;
  if(MG) MG.gain.value=soundOn?0.35:0;
  document.getElementById('stog').textContent=soundOn?'🔊 SFX':'🔇 OFF';
});

// ═══════════════════════════════════════
// SOCKET + STATE
// ═══════════════════════════════════════
const socket = io({ transports:['websocket','polling'] });

let serverPlayers = [];   // raw server state (for other players)
let serverBullets  = [];
let walls = [], mapW=1200, mapH=800;
let myId=null, myChar=null, myName='Player';

// ── CLIENT-SIDE PREDICTION ──
// We keep our own local copy of our player and move it immediately.
// Server state is used only to correct us if we're wrong.
let local = {
  x:600, y:400, angle:0,
  health:100, maxHealth:100,
  alive:true, kills:0,
  ammo:12, maxAmmo:12, reloading:false, speed:4
};

let camX=0, camY=0;
let particles=[], muzzleFlashes=[];
let screenShake=0, prevHealth=100;
let respawnTimer=null, reloadStart=0, reloadDur=0, stepT=0;

// Input
const keys={};
let mouseX=0, mouseY=0;
let shootIv=null;

// Mobile joystick state
const stick={
  L:{ active:false, id:null, ox:0, oy:0, dx:0, dy:0 },   // move
  R:{ active:false, id:null, ox:0, oy:0, dx:0, dy:0 }    // aim
};

// Canvas
const canvas=document.getElementById('gc');
const ctx=canvas.getContext('2d');
const mmCvs=document.getElementById('mm');
const mmCtx=mmCvs.getContext('2d');
let vW=window.innerWidth, vH=window.innerHeight;

// ═══════════════════════════════════════
// LOBBY
// ═══════════════════════════════════════
let selChar=null;
const nameEl=document.getElementById('pname');
const bPlay=document.getElementById('bplay');

Object.entries(CHARS).forEach(([k,ch])=>{
  const card=document.createElement('div');
  card.className='cc';
  const pv=document.createElement('canvas');
  pv.className='cpv'; pv.width=48; pv.height=48;
  drawPreview(pv,ch);
  const hp=Math.round((ch.hp/140)*100), sp=Math.round((ch.spd/5.2)*100), dm=Math.round(({Andree:31,Chesney:64,Denver:21,Fishcer:100,Maybelle:43}[k]||50));
  card.appendChild(pv);
  card.innerHTML+=`<div class="cn" style="color:${ch.color}">${k.toUpperCase()}</div>
    <div class="cw">${ch.weapon}</div>
    <div class="sr"><span class="sl">HP</span><div class="sb"><div class="sf" style="width:${hp}%;background:#00e676"></div></div></div>
    <div class="sr"><span class="sl">SPD</span><div class="sb"><div class="sf" style="width:${sp}%;background:#00e5ff"></div></div></div>
    <div class="sr"><span class="sl">DMG</span><div class="sb"><div class="sf" style="width:${dm}%;background:#ff6b35"></div></div></div>`;
  card.addEventListener('click',()=>{
    initAudio();
    document.querySelectorAll('.cc').forEach(c=>c.classList.remove('sel'));
    card.classList.add('sel'); selChar=k; checkReady();
  });
  document.getElementById('cgrid').appendChild(card);
});

function drawPreview(cvs,ch){
  const c=cvs.getContext('2d'); c.imageSmoothingEnabled=false;
  const cx=24,cy=24;
  c.fillStyle='rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(cx,cy+12,10,5,0,0,Math.PI*2); c.fill();
  c.fillStyle=ch.bodyColor; c.fillRect(cx-8,cy+2,6,10); c.fillRect(cx+2,cy+2,6,10);
  c.fillRect(cx-9,cy-8,18,14);
  c.fillStyle=ch.color+'aa'; c.fillRect(cx-6,cy-6,12,8);
  c.fillStyle=ch.color; c.fillRect(cx-6,cy-18,12,12);
  c.fillStyle='#000'; c.fillRect(cx-4,cy-15,3,3); c.fillRect(cx+1,cy-15,3,3);
  c.fillStyle='#fff'; c.fillRect(cx-3,cy-14,2,2); c.fillRect(cx+2,cy-14,2,2);
  c.fillStyle='#888'; c.fillRect(cx+8,cy-4,14,4); c.fillRect(cx+20,cy-6,3,8);
}

nameEl.addEventListener('input',checkReady);
function checkReady(){ bPlay.disabled=!(nameEl.value.trim()&&selChar); }

bPlay.addEventListener('click',()=>{
  initAudio();
  myName=nameEl.value.trim()||'Player'; myChar=selChar;
  socket.emit('join',{name:myName,character:myChar});
});

// ═══════════════════════════════════════
// SOCKET EVENTS
// ═══════════════════════════════════════
socket.on('map_data',d=>{ walls=d.walls; mapW=d.width; mapH=d.height; });
socket.on('joined',d=>{ myId=d.id; startGame(); });

// Compact game state (arrays instead of objects)
socket.on('gs', state=>{
  // Decode compact format
  serverPlayers = state.p.map(p=>({
    id:p[0], x:p[1], y:p[2], angle:p[3],
    health:p[4], maxHealth:p[5], alive:!!p[6],
    kills:p[7], ammo:p[8], maxAmmo:p[9], reloading:!!p[10],
    name:p[11], character:p[12], color:p[13]
  }));
  serverBullets = state.b.map(b=>({x:b[0],y:b[1],angle:b[2],size:b[3],color:b[4]}));

  // Reconcile local player with server
  const srv = serverPlayers.find(p=>p.id===myId);
  if(srv){
    // Smooth correction: if server says we're far off, snap; otherwise blend
    const dx=srv.x-local.x, dy=srv.y-local.y;
    const d2=dx*dx+dy*dy;
    if(d2>40*40){
      // Large discrepancy — hard snap (hit a wall we didn't predict)
      local.x=srv.x; local.y=srv.y;
    } else if(d2>4){
      // Small drift — gentle lerp (10%)
      local.x+=dx*0.1; local.y+=dy*0.1;
    }
    // Always trust server for health/kills/ammo/alive
    const wasAlive=local.alive;
    local.health=srv.health; local.maxHealth=srv.maxHealth;
    local.alive=srv.alive; local.kills=srv.kills;
    local.ammo=srv.ammo; local.maxAmmo=srv.maxAmmo;
    local.reloading=srv.reloading; local.speed=srv.speed||local.speed;

    if(local.health<prevHealth && local.health>0){
      flashDamage(1-local.health/local.maxHealth);
      screenShake=Math.max(screenShake,5*(1-local.health/local.maxHealth)+2);
      playSound('hit');
    }
    if(!local.alive && wasAlive){
      playSound('death');
      document.getElementById('ds').classList.add('vis');
      startCountdown();
    }
    prevHealth=local.health;
    updateReloadBar();
  }
  updateHUD();
});

// Immediate hit feedback (don't wait for next state broadcast)
socket.on('hit_confirm',({health})=>{
  local.health=health;
  flashDamage(1-health/local.maxHealth);
  screenShake=Math.max(screenShake,4);
  playSound('hit');
  prevHealth=health;
});

socket.on('kill_feed',({killer,victim,killerChar})=>{
  addKF(killer,victim,killerChar);
  if(killer===myName) playSound('kill');
});
socket.on('player_respawn',({id})=>{
  if(id===myId){
    document.getElementById('ds').classList.remove('vis');
    if(respawnTimer) clearInterval(respawnTimer);
    local.alive=true; local.health=local.maxHealth;
    prevHealth=local.maxHealth;
    playSound('respawn');
    spawnParts(local.x,local.y,'#00e5ff',12,'spark');
  }
});
socket.on('game_over',({winner,character})=>{
  document.getElementById('gow').textContent=`🏆 ${winner} WINS!`;
  document.getElementById('gow').style.color=CHARS[character]?.color||'#ffeb3b';
  document.getElementById('gos').classList.add('vis');
  playSound('kill'); stopFire();
});
socket.on('game_reset',()=>{
  document.getElementById('gos').classList.remove('vis');
  document.getElementById('ds').classList.remove('vis');
  particles=[]; muzzleFlashes=[];
});
document.getElementById('bng').addEventListener('click',()=>socket.emit('new_game'));

// ═══════════════════════════════════════
// START GAME
// ═══════════════════════════════════════
function startGame(){
  document.getElementById('lobby').style.display='none';
  canvas.style.display='block';
  document.getElementById('hud').style.display='block';
  document.getElementById('mm').style.display='block';
  if(IS_MOBILE){ document.getElementById('mctrl').style.display='block'; setupMobile(); }
  resizeCvs(); setupDesktop();
  const ch=CHARS[myChar];
  if(ch){
    const cn=document.getElementById('cnh'); cn.textContent=myChar.toUpperCase(); cn.style.color=ch.color;
    document.getElementById('wnh').textContent=ch.weapon;
    local.speed=ch.spd; local.maxHealth=ch.hp; local.health=ch.hp; local.maxAmmo=ch.maxAmmo; local.ammo=ch.maxAmmo;
  }
  requestAnimationFrame(loop);
}
function resizeCvs(){ vW=canvas.width=window.innerWidth; vH=canvas.height=window.innerHeight; }
window.addEventListener('resize',resizeCvs);

// ═══════════════════════════════════════
// DESKTOP INPUT
// ═══════════════════════════════════════
function setupDesktop(){
  document.addEventListener('keydown',e=>{
    keys[e.key.toLowerCase()]=true;
    if(e.key.toLowerCase()==='r') doReload();
    e.preventDefault();
  });
  document.addEventListener('keyup',e=>{ keys[e.key.toLowerCase()]=false; });
  canvas.addEventListener('mousemove',e=>{ mouseX=e.clientX; mouseY=e.clientY; });
  canvas.addEventListener('mousedown',e=>{
    if(e.button!==0) return;
    initAudio(); fire(); shootIv=setInterval(fire,90);
  });
  canvas.addEventListener('mouseup',e=>{ if(e.button===0) clearInterval(shootIv); });
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
}

// ═══════════════════════════════════════
// MOBILE DUAL JOYSTICK
// ═══════════════════════════════════════
function setupMobile(){
  const LZ=document.getElementById('lzone'), LK=document.getElementById('lknob');
  const RZ=document.getElementById('rzone'), RK=document.getElementById('rknob');
  const BF=document.getElementById('bfire'), BR=document.getElementById('brl');
  const JR=55; // joystick radius px

  function mkStick(zone,knob,s){
    zone.addEventListener('touchstart',e=>{
      e.preventDefault(); initAudio();
      const t=e.changedTouches[0];
      const r=zone.getBoundingClientRect();
      s.active=true; s.id=t.identifier;
      s.ox=r.left+r.width/2; s.oy=r.top+r.height/2;
      updateStick(s,knob,t.clientX,t.clientY,JR);
    },{passive:false});
    zone.addEventListener('touchmove',e=>{
      e.preventDefault();
      for(const t of e.changedTouches){
        if(t.identifier===s.id) updateStick(s,knob,t.clientX,t.clientY,JR);
      }
    },{passive:false});
    zone.addEventListener('touchend',e=>{
      e.preventDefault();
      for(const t of e.changedTouches){
        if(t.identifier===s.id){ s.active=false; s.id=null; s.dx=0; s.dy=0; knob.style.transform='translate(-50%,-50%)'; }
      }
    },{passive:false});
    zone.addEventListener('touchcancel',e=>{
      s.active=false; s.id=null; s.dx=0; s.dy=0; knob.style.transform='translate(-50%,-50%)';
    },{passive:false});
  }

  function updateStick(s,knob,cx,cy,r){
    let dx=cx-s.ox, dy=cy-s.oy;
    const d=Math.sqrt(dx*dx+dy*dy);
    if(d>r){ dx=dx/d*r; dy=dy/d*r; }
    s.dx=dx/r; s.dy=dy/r;
    knob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
  }

  mkStick(LZ,LK,stick.L);
  mkStick(RZ,RK,stick.R);

  // Right stick: when active, auto-fire
  RZ.addEventListener('touchstart',e=>{
    e.preventDefault();
    // Start firing when right stick is touched
    if(!stick.R.active) return;
  },{passive:false});

  // Dedicated fire button
  BF.addEventListener('touchstart',e=>{
    e.preventDefault(); initAudio();
    BF.classList.add('act');
    fire(); shootIv=setInterval(fire,90);
  },{passive:false});
  BF.addEventListener('touchend',e=>{ e.preventDefault(); stopFire(); BF.classList.remove('act'); },{passive:false});
  BF.addEventListener('touchcancel',()=>{ stopFire(); BF.classList.remove('act'); });

  // Right stick also fires when moved (auto-aim-and-shoot feel)
  const origRMove=RZ.ontouchmove;
  RZ.addEventListener('touchmove',e=>{
    // Auto-fire when right stick is dragged outward (>30% deflection)
    const mag=Math.sqrt(stick.R.dx*stick.R.dx+stick.R.dy*stick.R.dy);
    if(mag>0.3 && !shootIv){ fire(); shootIv=setInterval(fire,90); }
    else if(mag<=0.3 && shootIv){ stopFire(); }
  },{passive:false});

  RZ.addEventListener('touchend',()=>stopFire());
  RZ.addEventListener('touchcancel',()=>stopFire());

  BR.addEventListener('touchstart',e=>{ e.preventDefault(); initAudio(); doReload(); },{passive:false});
}

function stopFire(){ clearInterval(shootIv); shootIv=null; }

// ═══════════════════════════════════════
// FIRE + RELOAD
// ═══════════════════════════════════════
function fire(){
  if(!local.alive||local.reloading) return;
  if(local.ammo<=0){ playSound('empty'); return; }
  socket.emit('shoot');
  // Visual only — actual hit detection is server-side
  const ang=getAimAngle();
  muzzleFlashes.push({ x:local.x+Math.cos(ang)*22, y:local.y+Math.sin(ang)*22, angle:ang, life:6, color:CHARS[myChar]?.color||'#fff' });
  const perp=ang+Math.PI/2+(Math.random()-0.5)*0.3;
  particles.push({x:local.x,y:local.y,vx:Math.cos(perp)*2,vy:Math.sin(perp)*2-1,life:40,maxLife:40,color:'#c8a000',size:2,type:'shell'});
  screenShake=Math.max(screenShake,1.5);
  const wm={Andree:'shoot_rifle',Chesney:'shoot_shotgun',Denver:'shoot_smg',Fishcer:'shoot_sniper',Maybelle:'shoot_revolver'};
  playSound(wm[myChar]||'shoot_rifle');
}

function doReload(){
  if(!local.alive||local.reloading||local.ammo>=local.maxAmmo) return;
  socket.emit('reload');
  playSound('reload');
  reloadDur=CHARS[myChar]?.reloadTime||1500; reloadStart=performance.now();
}

function getAimAngle(){
  if(IS_MOBILE && stick.R.active){
    return Math.atan2(stick.R.dy, stick.R.dx);
  }
  return Math.atan2((mouseY+camY)-local.y, (mouseX+camX)-local.x);
}

// ═══════════════════════════════════════
// MOVEMENT — client-side prediction
// ═══════════════════════════════════════
function sendMovement(){
  if(!local.alive) return;
  const spd=local.speed||4;
  let vx=0, vy=0;

  if(IS_MOBILE && stick.L.active){
    vx=stick.L.dx;
    vy=stick.L.dy;
  } else {
    if(keys['w']||keys['arrowup'])    vy-=1;
    if(keys['s']||keys['arrowdown'])  vy+=1;
    if(keys['a']||keys['arrowleft'])  vx-=1;
    if(keys['d']||keys['arrowright']) vx+=1;
    const len=Math.sqrt(vx*vx+vy*vy);
    if(len>0){ vx/=len; vy/=len; }
  }

  const angle=getAimAngle();

  // LOCAL PREDICTION: move ourselves immediately, don't wait for server
  if(vx!==0||vy!==0){
    const nx=local.x+vx*spd, ny=local.y+vy*spd;
    if(!clientWallCheck(nx, ny)) { local.x=nx; local.y=ny; }
    else if(!clientWallCheck(nx, local.y)) { local.x=nx; }
    else if(!clientWallCheck(local.x, ny)) { local.y=ny; }
    local.x=Math.max(P_RADIUS+20,Math.min(mapW-P_RADIUS-20,local.x));
    local.y=Math.max(P_RADIUS+20,Math.min(mapH-P_RADIUS-20,local.y));

    // Footsteps
    stepT--;
    if(stepT<=0){ playSound('step'); stepT=20; }
    if(Math.random()<0.1) particles.push({x:local.x+(Math.random()-0.5)*8,y:local.y+12,vx:(Math.random()-0.5)*0.5,vy:-0.3,life:20,maxLife:20,color:'#2a2a2a',size:2,type:'dust'});
  }

  local.angle=angle;
  // Send velocity direction to server (normalized)
  socket.emit('mv',{ vx, vy, angle });
}

// Client-side wall collision (mirrors server)
function clientWallCheck(cx,cy){
  for(const w of walls){
    const nx=Math.max(w.x,Math.min(cx,w.x+w.w));
    const ny=Math.max(w.y,Math.min(cy,w.y+w.h));
    const dx=cx-nx, dy=cy-ny;
    if(dx*dx+dy*dy<P_RADIUS*P_RADIUS) return true;
  }
  return false;
}

// ═══════════════════════════════════════
// PARTICLES
// ═══════════════════════════════════════
function spawnParts(x,y,color,count,type){
  for(let i=0;i<count;i++){
    const a=(Math.PI*2*i/count)+Math.random()*0.5, sp=1.5+Math.random()*3;
    particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:30+Math.random()*20|0,maxLife:50,color,size:2+Math.random()*2,type});
  }
}
function tickParts(){
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i]; p.x+=p.vx; p.y+=p.vy; p.vx*=0.92; p.vy*=0.92;
    if(p.type!=='shell') p.vy+=0.04; p.life--;
    if(p.life<=0) particles.splice(i,1);
  }
  for(let i=muzzleFlashes.length-1;i>=0;i--){
    muzzleFlashes[i].life--;
    if(muzzleFlashes[i].life<=0) muzzleFlashes.splice(i,1);
  }
}

// ═══════════════════════════════════════
// HUD
// ═══════════════════════════════════════
function updateHUD(){
  const hp=Math.max(0,(local.health/local.maxHealth)*100);
  document.getElementById('hbar').style.width=hp+'%';
  document.getElementById('hbar').style.background=hp>50?'linear-gradient(90deg,#00e676,#69f0ae)':hp>25?'linear-gradient(90deg,#ffeb3b,#ffd740)':'linear-gradient(90deg,#ff1744,#ff6b35)';
  document.getElementById('hval').textContent=Math.ceil(local.health);
  const av=document.getElementById('av');
  av.textContent=local.ammo; av.style.color=local.ammo===0?'#ff1744':local.ammo<=3?'#ff6b35':'#ffeb3b';
  document.getElementById('am').textContent='/ '+local.maxAmmo;
  document.getElementById('myk').textContent=local.kills;
  updateSB();
}
function updateReloadBar(){
  const w=document.getElementById('rlw'), i=document.getElementById('rli');
  if(local.reloading){
    w.style.display='flex';
    if(reloadDur>0) i.style.width=Math.min(100,((performance.now()-reloadStart)/reloadDur)*100)+'%';
  } else { w.style.display='none'; i.style.width='0%'; }
}
function updateSB(){
  // Build scoreboard from serverPlayers + local override
  const all=serverPlayers.map(p=>p.id===myId?{...p,...{kills:local.kills,health:local.health,alive:local.alive}}:p);
  if(!all.find(p=>p.id===myId)&&myId) all.push({...local,id:myId,name:myName,character:myChar,color:CHARS[myChar]?.color||'#fff'});
  document.getElementById('sbr').innerHTML=all.sort((a,b)=>b.kills-a.kills).map(p=>{
    const me=p.id===myId, c=CHARS[p.character]?.color||'#fff';
    return `<div class="sr2"><div class="sd" style="background:${c}"></div><span class="sn" style="color:${me?c:'#777'}">${me?'►':''}${p.name}</span><span class="sk">${p.kills}</span></div>`;
  }).join('');
}
function addKF(killer,victim,kc){
  const f=document.getElementById('kf'), el=document.createElement('div');
  el.className='ke'; const c=CHARS[kc]?.color||'#fff';
  el.style.borderLeftColor=c;
  el.innerHTML=`<span style="color:${c}">${killer}</span> <span style="color:#555">✦</span> ${victim}`;
  f.appendChild(el); setTimeout(()=>el.remove(),3000);
}
function flashDamage(i){
  const el=document.getElementById('df');
  el.style.background=`rgba(255,0,0,${Math.min(0.45,i*0.5)})`;
  setTimeout(()=>{ el.style.background='rgba(255,0,0,0)'; },120);
}
function startCountdown(){
  let c=3; document.getElementById('rcd').textContent=c;
  if(respawnTimer) clearInterval(respawnTimer);
  respawnTimer=setInterval(()=>{ c--; if(c<=0){clearInterval(respawnTimer);return;} document.getElementById('rcd').textContent=c; },1000);
}

// ═══════════════════════════════════════
// CAMERA
// ═══════════════════════════════════════
function updateCam(){
  let lx=0, ly=0;
  if(!IS_MOBILE){ lx=(mouseX-vW/2)*0.08; ly=(mouseY-vH/2)*0.08; }
  else if(stick.R.active){ lx=stick.R.dx*60; ly=stick.R.dy*60; }
  const tx=local.x-vW/2+lx, ty=local.y-vH/2+ly;
  camX+=(tx-camX)*0.12; camY+=(ty-camY)*0.12;
  camX=Math.max(0,Math.min(camX,mapW-vW));
  camY=Math.max(0,Math.min(camY,mapH-vH));
  if(screenShake>0){ camX+=(Math.random()-0.5)*screenShake; camY+=(Math.random()-0.5)*screenShake; screenShake*=0.75; if(screenShake<0.1) screenShake=0; }
}

// ═══════════════════════════════════════
// RENDERING
// ═══════════════════════════════════════
function drawFloor(){
  ctx.fillStyle='#0c0c18'; ctx.fillRect(0,0,vW,vH);
  const gs=48, ox=(((-camX)%gs)+gs)%gs, oy=(((-camY)%gs)+gs)%gs;
  for(let gx=ox-gs;gx<vW+gs;gx+=gs) for(let gy=oy-gs;gy<vH+gs;gy+=gs){
    const tx=((gx-ox+camX)/gs)|0, ty=((gy-oy+camY)/gs)|0;
    ctx.fillStyle=(tx+ty)%2===0?'#0e0e1c':'#0a0a14'; ctx.fillRect(gx,gy,gs,gs);
  }
  ctx.strokeStyle='#13132a'; ctx.lineWidth=1;
  for(let x=ox;x<vW;x+=gs){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,vH);ctx.stroke();}
  for(let y=oy;y<vH;y+=gs){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(vW,y);ctx.stroke();}
}

function drawWalls(){
  walls.forEach(w=>{
    const wx=w.x-camX, wy=w.y-camY;
    ctx.fillStyle='#18182e'; ctx.fillRect(wx,wy,w.w,w.h);
    ctx.strokeStyle='#0f0f20'; ctx.lineWidth=1;
    for(let by=wy+12;by<wy+w.h;by+=12){ ctx.beginPath();ctx.moveTo(wx,by);ctx.lineTo(wx+w.w,by);ctx.stroke(); }
    ctx.fillStyle='#2a2a4a'; ctx.fillRect(wx,wy,w.w,4); ctx.fillRect(wx,wy,4,w.h);
    ctx.fillStyle='#08081a'; ctx.fillRect(wx,wy+w.h-3,w.w,3); ctx.fillRect(wx+w.w-3,wy,3,w.h);
    ctx.strokeStyle='rgba(0,229,255,0.04)'; ctx.strokeRect(wx,wy,w.w,w.h);
  });
}

// Draw a player — local uses predicted position, others use server position
function drawPlayer(p, isLocal){
  const sx=(isLocal?local.x:p.x)-camX;
  const sy=(isLocal?local.y:p.y)-camY;
  const angle=isLocal?local.angle:p.angle;
  const alive=isLocal?local.alive:p.alive;
  const ch=CHARS[p.character];
  const color=ch?ch.color:'#fff';
  const bodyColor=ch?ch.bodyColor:'#333';

  if(!alive){
    ctx.globalAlpha=0.35; ctx.save(); ctx.translate(sx,sy);
    ctx.fillStyle='#300'; ctx.beginPath(); ctx.ellipse(0,0,P_RADIUS,P_RADIUS*0.5,0.4,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#600'; ctx.fillRect(-8,-3,16,6);
    ctx.globalAlpha=1; ctx.restore(); return;
  }

  // Shadow
  ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.beginPath();
  ctx.ellipse(sx+2,sy+6,P_RADIUS-2,P_RADIUS*0.4,0,0,Math.PI*2); ctx.fill();

  ctx.save(); ctx.translate(sx,sy); ctx.rotate(angle);

  const la=Math.sin(Date.now()*0.008+sx*0.1)*3;
  ctx.fillStyle=bodyColor;
  ctx.fillRect(-7,4,6,10+la); ctx.fillRect(1,4,6,10-la);
  ctx.fillStyle='#222'; ctx.fillRect(-8,12+la,7,4); ctx.fillRect(0,12-la,7,4);

  ctx.fillStyle=bodyColor; ctx.fillRect(-9,-8,18,16);
  ctx.fillStyle=color+'55'; ctx.fillRect(-7,-7,14,12);
  ctx.fillStyle=color+'cc'; ctx.fillRect(-3,-6,6,10);
  ctx.fillStyle=bodyColor; ctx.fillRect(-12,-6,5,8); ctx.fillRect(7,-6,5,8);

  ctx.fillStyle=color; ctx.fillRect(-6,-18,12,12);
  ctx.fillStyle=color+'aa'; ctx.fillRect(-6,-18,12,4);
  ctx.fillStyle='#000'; ctx.fillRect(-4,-15,3,3); ctx.fillRect(1,-15,3,3);
  ctx.fillStyle='#fff'; ctx.fillRect(-3,-14,2,2); ctx.fillRect(2,-14,2,2);

  ctx.fillStyle='#555'; ctx.fillRect(6,-3,16,5);
  ctx.fillStyle='#333'; ctx.fillRect(4,-4,8,7);
  ctx.fillStyle='#777'; ctx.fillRect(20,-4,4,7);

  if(isLocal){
    ctx.strokeStyle=color; ctx.lineWidth=1.5;
    ctx.shadowColor=color; ctx.shadowBlur=10;
    ctx.strokeRect(-10,-20,20,30); ctx.shadowBlur=0;
  }
  ctx.restore();

  const name=isLocal?myName:p.name;
  ctx.font=`6px ${FONT}`; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(sx-28,sy-P_RADIUS-22,56,10);
  ctx.fillStyle=isLocal?'#fff':'#aaa';
  ctx.fillText(name,sx,sy-P_RADIUS-17);

  const hw=36,hx=sx-hw/2,hy=sy-P_RADIUS-10;
  const hp=(isLocal?local.health:p.health)/(isLocal?local.maxHealth:p.maxHealth);
  ctx.fillStyle='#000'; ctx.fillRect(hx-1,hy-1,hw+2,7);
  ctx.fillStyle='#111'; ctx.fillRect(hx,hy,hw,5);
  ctx.fillStyle=hp>0.5?'#00e676':hp>0.25?'#ffeb3b':'#ff1744';
  ctx.fillRect(hx,hy,hw*Math.max(0,hp),5);
}

function drawBullets(){
  serverBullets.forEach(b=>{
    const sx=b.x-camX, sy=b.y-camY, s=b.size||4;
    ctx.shadowColor=b.color; ctx.shadowBlur=10;
    ctx.fillStyle='#fff'; ctx.fillRect(sx-s*0.4,sy-s*0.4,s*0.8,s*0.8);
    ctx.fillStyle=b.color; ctx.fillRect(sx-s/2,sy-s/2,s,s);
    ctx.globalAlpha=0.3;
    ctx.fillRect(sx-s/2-Math.cos(+b.angle)*8,sy-s/2-Math.sin(+b.angle)*8,s*0.6,s*0.6);
    ctx.globalAlpha=1; ctx.shadowBlur=0;
  });
}

function drawMuzzle(){
  muzzleFlashes.forEach(m=>{
    const sx=m.x-camX, sy=m.y-camY;
    ctx.globalAlpha=m.life/6; ctx.shadowColor=m.color; ctx.shadowBlur=20;
    ctx.save(); ctx.translate(sx,sy); ctx.rotate(m.angle);
    ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.moveTo(-14,0);ctx.lineTo(-3,3);ctx.lineTo(0,14);ctx.lineTo(3,3);ctx.lineTo(14,0);ctx.lineTo(3,-3);ctx.lineTo(0,-14);ctx.lineTo(-3,-3);ctx.closePath();ctx.fill();
    ctx.fillStyle=m.color; ctx.beginPath();ctx.arc(0,0,8,0,Math.PI*2);ctx.fill();
    ctx.restore(); ctx.shadowBlur=0; ctx.globalAlpha=1;
  });
}

function drawParts(){
  particles.forEach(p=>{
    const a=p.life/p.maxLife, sx=p.x-camX, sy=p.y-camY;
    ctx.globalAlpha=a;
    if(p.type==='shell'){
      ctx.fillStyle=p.color; ctx.save(); ctx.translate(sx,sy); ctx.rotate(p.life*0.3);
      ctx.fillRect(-p.size,-p.size*0.5,p.size*2,p.size); ctx.restore();
    } else if(p.type==='spark'){
      ctx.shadowColor=p.color; ctx.shadowBlur=5; ctx.fillStyle=p.color;
      ctx.fillRect(sx-p.size/2,sy-p.size/2,p.size,p.size); ctx.shadowBlur=0;
    } else {
      ctx.fillStyle=p.color; ctx.beginPath();ctx.arc(sx,sy,p.size*a+0.3,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
  });
}

// Aim line for mobile (from local player toward right-stick direction)
function drawMobileAim(){
  if(!IS_MOBILE||!local.alive) return;
  const sx=local.x-camX, sy=local.y-camY;
  const ang=getAimAngle();
  const dist=70;
  const ax=sx+Math.cos(ang)*dist, ay=sy+Math.sin(ang)*dist;

  ctx.setLineDash([4,6]);
  ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ax,ay);ctx.stroke();
  ctx.setLineDash([]);

  const ch=CHARS[myChar]; const c=ch?ch.color:'#fff';
  ctx.strokeStyle=c; ctx.lineWidth=1.5;
  ctx.shadowColor=c; ctx.shadowBlur=6;
  ctx.beginPath(); ctx.arc(ax,ay,5,0,Math.PI*2); ctx.stroke();
  ctx.shadowBlur=0;
}

function drawCrosshair(){
  if(IS_MOBILE||!local.alive) return;
  const ch=CHARS[myChar], c=ch?ch.color:'#fff';
  const cx=mouseX, cy=mouseY;
  ctx.strokeStyle=c+'aa'; ctx.lineWidth=1;
  ctx.beginPath();ctx.arc(cx,cy,12,0,Math.PI*2);ctx.stroke();
  ctx.strokeStyle='#fff'; ctx.lineWidth=1.5;
  const g=6,l=9;
  ctx.beginPath();
  ctx.moveTo(cx-g-l,cy);ctx.lineTo(cx-g,cy); ctx.moveTo(cx+g,cy);ctx.lineTo(cx+g+l,cy);
  ctx.moveTo(cx,cy-g-l);ctx.lineTo(cx,cy-g); ctx.moveTo(cx,cy+g);ctx.lineTo(cx,cy+g+l);
  ctx.stroke();
  ctx.fillStyle=c; ctx.fillRect(cx-2,cy-2,4,4);
}

function drawMinimap(){
  const mW=160,mH=107, sX=mW/mapW, sY=mH/mapH;
  mmCtx.clearRect(0,0,mW,mH);
  mmCtx.fillStyle='#060610'; mmCtx.fillRect(0,0,mW,mH);
  mmCtx.fillStyle='#2a2a4a';
  walls.forEach(w=>mmCtx.fillRect(w.x*sX,w.y*sY,Math.max(1,w.w*sX),Math.max(1,w.h*sY)));
  mmCtx.strokeStyle='rgba(255,255,255,0.08)'; mmCtx.lineWidth=1;
  mmCtx.strokeRect(camX*sX,camY*sY,vW*sX,vH*sY);
  // Other players
  serverPlayers.forEach(p=>{
    if(!p.alive||p.id===myId) return;
    const ch=CHARS[p.character]; mmCtx.fillStyle=ch?ch.color:'#aaa';
    mmCtx.fillRect(p.x*sX-2,p.y*sY-2,4,4);
  });
  // Local player (predicted pos)
  mmCtx.fillStyle='#fff'; mmCtx.fillRect(local.x*sX-3,local.y*sY-3,6,6);
  // Aim direction
  if(IS_MOBILE){
    const ang=getAimAngle();
    mmCtx.strokeStyle='rgba(255,255,255,0.35)'; mmCtx.lineWidth=1;
    mmCtx.beginPath(); mmCtx.moveTo(local.x*sX,local.y*sY);
    mmCtx.lineTo(local.x*sX+Math.cos(ang)*14,local.y*sY+Math.sin(ang)*14); mmCtx.stroke();
  }
}

// ═══════════════════════════════════════
// GAME LOOP
// ═══════════════════════════════════════
function loop(){
  sendMovement(); updateCam(); tickParts();
  ctx.clearRect(0,0,vW,vH);
  drawFloor(); drawWalls(); drawParts(); drawBullets(); drawMuzzle();

  // Draw other players from server state
  serverPlayers.forEach(p=>{ if(p.id!==myId) drawPlayer(p,false); });
  // Draw local player using predicted position
  if(myId) drawPlayer({character:myChar,color:CHARS[myChar]?.color||'#fff',name:myName,...local},true);

  drawMobileAim(); drawCrosshair(); drawMinimap();
  requestAnimationFrame(loop);
}
