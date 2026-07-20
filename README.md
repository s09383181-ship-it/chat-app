# 💬 Chat App

A simple peer-to-peer online chat built with **Vite + React + GUN.js**.

No backend. No database. Messages sync directly between users via the GUN network.

## Features

- 🔐 Sign up / sign in with username + password (GUN SEA encryption)
- 💬 Real-time global chat room
- 🌐 Peer-to-peer (no server needed)
- 📱 Responsive mobile-friendly UI

## Local development

```bash
npm install
npm run dev
```

## Build for production

```bash
npm run build
```

Output is in `dist/`. Deploy to any static host (GitHub Pages, Netlify, Vercel, etc).

## How it works

- **GUN.js** is a decentralized graph database. Each browser stores a copy of the chat and syncs with other peers via WebRTC and relay nodes.
- **SEA** (Security, Encryption, Auth) handles user accounts using public/private key pairs derived from the password.
- Messages live at `gun.get('chatapp/global-room')` — every signed-in user sees every message in real time.

## Live demo

https://s09383181-ship-it.github.io/chat-app/
