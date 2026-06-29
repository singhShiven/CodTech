# 🚀 Real-Time Collaborative Editor

A scalable multi-user real-time collaborative document editing system built with WebSocket protocol (Socket.IO), Node.js, and vanilla JavaScript.

## 📋 Project Overview

**Project Title:** Scalable Multi-User Real-Time Collaborative Editing System Using WebSocket Protocol

**Technology Stack:**
- **Backend:** Node.js, Express.js, Socket.IO
- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Protocol:** WebSocket (Socket.IO implementation)
- **Architecture:** Event-driven, room-based collaboration

## ✨ Features

- ✅ Real-time text synchronization across multiple users
- ✅ Room-based collaboration with unique Room IDs
- ✅ User join/leave notifications
- ✅ Active users display with color-coded avatars
- ✅ Typing indicators
- ✅ Activity log with timestamps
- ✅ Auto-reconnection on network failure
- ✅ Character and word count tracking
- ✅ Document export functionality
- ✅ Responsive design
- ✅ Production-ready error handling
- ✅ Scalable architecture

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm (v8 or higher)

### Installation

1. **Clone/Extract the project**
```bash
   cd real-time-collaborative-editor
```

2. **Install server dependencies**
```bash
   cd server
   npm install
```

3. **Create environment file**
```bash
   cp .env.example .env
```

4. **Start the server**
```bash
   npm start
```

5. **Open your browser**
```
   http://localhost:3000
```

### Running in Development Mode
```bash
cd server
npm run dev
```

This uses `nodemon` for auto-restart on file changes.

## 📖 How to Use

### For Single User Testing

1. Open `http://localhost:3000` in your browser
2. Enter your name (e.g., "Alice")
3. Enter a room ID (e.g., "demo-room")
4. Click "Join Room"
5. Start typing in the editor

### For Multi-User Collaboration (Live Demo)

1. **Open two browser windows** (or tabs) side by side
2. **Window 1:**
   - Name: `Alice`
   - Room ID: `demo-room`
   - Click "Join Room"

3. **Window 2:**
   - Name: `Bob`
   - Room ID: `demo-room`
   - Click "Join Room"

4. **Type in Window 1** - see instant reflection in Window 2
5. **Type in Window 2** - see instant reflection in Window 1

## 🏗️ Architecture
```
┌─────────────┐         WebSocket          ┌─────────────┐
│   Client 1  │◄────────────────────────────┤             │
├─────────────┤                             │             │
│   Client 2  │◄────────────────────────────┤   Server    │
├─────────────┤                             │  (Node.js)  │
│   Client 3  │◄────────────────────────────┤             │
└─────────────┘                             └─────────────┘
```

### Event Flow

1. User types in editor
2. Browser captures `input` event
3. JavaScript emits `content-change` via Socket.IO
4. Server receives event
5. Server updates room state (last-write-wins)
6. Server broadcasts to all other users in room
7. Other clients receive `content-update`
8. Other clients update their editors

## 📁 Project Structure
```
real-time-collaborative-editor/
├── server/
│   ├── config/
│   │   └── socket.config.js
│   ├── managers/
│   │   └── roomManager.js
│   ├── handlers/
│   │   └── socketHandler.js
│   ├── middleware/
│   │   └── errorHandler.js
│   ├── utils/
│   │   └── logger.js
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── client/
│   ├── assets/
│   │   ├── css/
│   │   │   └── styles.css
│   │   └── js/
│   │       ├── app.js
│   │       ├── socketClient.js
│   │       └── uiManager.js
│   └── index.html
└── README.md
```

## 🔧 Configuration

### Environment Variables (`.env`)
```env
PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000
SOCKET_PING_TIMEOUT=60000
SOCKET_PING_INTERVAL=25000
ROOM_CLEANUP_TIMEOUT=300000
MAX_USERS_PER_ROOM=50
```

## 🧪 Testing

### Manual Testing

1. **Concurrency Test:** Open 5 browser tabs, join same room, type simultaneously
2. **Network Test:** Disable WiFi, re-enable, verify auto-reconnection
3. **Large Document:** Paste 10,000 words, verify performance
4. **Edge Cases:** Special characters, emojis, empty content

### Load Testing
```bash
npm install -g artillery
artillery quick --count 100 --num 50 http://localhost:3000
```

## 🌐 Deployment

### Deploy to Render

1. Push code to GitHub
2. Create new Web Service on Render
3. Connect repository
4. Build command: `cd server && npm install`
5. Start command: `cd server && npm start`
6. Add environment variables
7. Deploy

### Deploy to Railway
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

## 🎯 Live Demo Walkthrough (for Viva)

### What to Say:

> "This is a real-time collaborative editing system built with WebSocket protocol. Let me demonstrate..."

**Step 1:** Show two browser windows
> "I have two users - Alice and Bob - connecting to the same room."

**Step 2:** Type in one window
> "As I type in Alice's window... notice Bob's window updates instantly. This is real-time synchronization."

**Step 3:** Show activity log
> "The activity feed shows all events: joins, leaves, and edits with timestamps."

**Step 4:** Disconnect one user
> "When Bob leaves, notice the notification and user count updates automatically."

## 📊 Scalability Discussion

### Current Capacity
- **Users per room:** Up to 50
- **Concurrent rooms:** Unlimited (memory-limited)
- **Recommended:** Up to 100 concurrent users on single server

### Horizontal Scaling

Add Redis adapter for multi-server deployment:
```javascript
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

const pubClient = createClient({ url: 'redis://localhost:6379' });
const subClient = pubClient.duplicate();

io.adapter(createAdapter(pubClient, subClient));
```

### Enterprise Scale (10,000+ users)
- Kubernetes orchestration
- Load balancing across multiple servers
- Redis for state sharing
- Database for persistence
- CDN for static assets

## 🐛 Troubleshooting

### Issue: Cannot connect to server
**Solution:** Check if server is running on port 3000, verify firewall settings

### Issue: Changes not syncing
**Solution:** Check browser console for WebSocket errors, verify room IDs match

### Issue: High latency
**Solution:** Check network connection, consider deploying closer to users

## 📝 License

MIT License - free for academic and commercial use

## 👨‍💻 Author

**Your Name**  
BTech Final Year Project  
Manipal University Jaipur

## 📧 Contact

- Email: shivendrasingh0020@gmail.com
