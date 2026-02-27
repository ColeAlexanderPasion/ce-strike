# 🎮 CE Strike — Retro Multiplayer Top-Down Shooter

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start server
node server.js

# 3. Open browser(s)
http://localhost:3000
```

Open multiple browser tabs or windows to play multiplayer!

---

## 📁 Folder Structure

```
ce-strike/
├── server.js          # Node.js game server (Express + Socket.io)
├── package.json       # Dependencies
├── README.md
└── public/
    ├── index.html     # Game client & lobby UI
    └── client.js      # Canvas rendering, input, socket comms
```

---

## 🕹️ Controls

| Key/Action | Description |
|---|---|
| WASD | Move |
| Mouse | Aim |
| Left Click | Shoot |
| R | Reload |

---

## 👥 Characters

| Character | Weapon | HP | Speed | Damage |
|---|---|---|---|---|
| Andree | Assault Rifle | 100 | ●●●● | ●●● |
| Chesney | Shotgun | 140 | ●● | ●●●●● |
| Denver | SMG | 80 | ●●●●● | ●● |
| Fishcer | Sniper | 90 | ●●● | ●●●●● |
| Maybelle | Revolver | 110 | ●●● | ●●●● |

---

## 🌐 Multiplayer

- Real-time via Socket.io
- Server-authoritative damage & collision
- Auto-respawn after 3 seconds
- First to **15 kills** wins

---

## Tech Stack

- **Server:** Node.js, Express, Socket.io
- **Client:** Vanilla JS, HTML5 Canvas
- **Font:** Press Start 2P (Google Fonts)
