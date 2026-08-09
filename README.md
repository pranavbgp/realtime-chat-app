# Real-time Chat Application

A full-stack real-time chat application built with **React (Vite)** on the frontend and **Node.js + Express + Socket.io** on the backend.

## Features

-  Real-time messaging via Socket.io (no polling)
-  Instant message delivery & broadcast to all connected clients
-  Chat history persisted in memory (survives page refresh while server is running)
-  Message timestamps with date separators
-  Username-based join (dummy authentication)
-  Online/offline user list
-  Typing indicators
-  Graceful connection/disconnection handling
-  REST APIs for messages and online users
-  Clean, modern, responsive dark UI
-  Error handling for API and Socket events

## Project Structure

```
chat-app/
├── backend/
│   ├── src/
│   │   └── server.js          # Express + Socket.io server
│   ├── package.json
│   └── ...
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # Main chat component
│   │   ├── App.css            # Styles
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── ...
└── README.md
```

## Prerequisites

- Node.js 18+ and npm
- Modern browser (Chrome, Firefox, Edge, Safari)

## Setup Instructions

### 1. Clone / Download the project

```bash
cd chat-app
```

### 2. Backend Setup

```bash
cd backend
npm install
```

**Environment variables** (optional):

| Variable | Default | Description          |
|----------|---------|----------------------|
| `PORT`   | `5000`  | Port the server runs on |

Create a `.env` file if needed (not required for local run):

```
PORT=5000
```

**Run the backend:**

```bash
# Development (with auto-reload if nodemon is installed)
npm run dev

# Or production
npm start
```

Server starts at `http://localhost:5000`.

### 3. Frontend Setup

```bash
cd frontend
npm install
```

**Environment variables** (optional):

| Variable            | Default                  | Description                |
|---------------------|--------------------------|----------------------------|
| `VITE_SOCKET_URL`   | `http://localhost:5000`  | Backend Socket.io / API URL |

Create `.env` in the frontend folder if you need a custom backend URL:

```
VITE_SOCKET_URL=http://localhost:5000
```

**Run the frontend:**

```bash
npm run dev
```

Open the URL shown (usually `http://localhost:5173`).

### 4. Using the App

1. Open the frontend in your browser.
2. Enter a username (2–20 characters) and click **Join Chat**.
3. Start messaging. Open multiple tabs/windows with different usernames to test real-time features.
4. Refresh the page — previous messages still appear (as long as the backend is running).

## API Endpoints

| Method | Endpoint            | Description                  |
|--------|---------------------|------------------------------|
| GET    | `/`                 | Health check                 |
| GET    | `/api/messages`     | Fetch chat history           |
| POST   | `/api/messages`     | Send a message (REST)        |
| GET    | `/api/users/online` | List currently online users  |

**POST /api/messages body:**

```json
{
  "content": "Hello!",
  "username": "Alice",
  "userId": "optional-uuid"
}
```

## Socket.io Events

### Client → Server
- `join` — `{ username, userId }`
- `send_message` — `{ content }`
- `typing` / `stop_typing`
- `message_read` — `{ messageId }` (basic support)

### Server → Client
- `chat_history` — array of past messages
- `new_message` — newly created message object
- `online_users` — list of online users
- `user_joined` / `user_left`
- `user_typing`
- `message_status`
- `error`

## Design Decisions

1. **In-memory message store** — Chosen for simplicity and zero external dependencies. Messages survive page refreshes while the server process is alive. For production, swap to MongoDB / PostgreSQL / SQLite (easy to add).
2. **React (Vite) instead of React Native** — Faster to set up, easier to demo in a browser, and fully meets the real-time requirements. The Socket.io logic is identical for React Native.
3. **Username-only “auth”** — Dummy authentication as requested in the bonus section. No passwords or JWT; a random `userId` is stored in `localStorage`.
4. **CORS** — Explicitly allowed for common local Vite/CRA ports.
5. **Dual send paths** — Messages can be sent via Socket (`send_message`) or REST (`POST /api/messages`). Both broadcast via Socket.io.
6. **Clean separation** — Backend logic lives in a single well-commented `server.js`; frontend is a single cohesive component with clear state management.

## Assumptions

- Users run backend and frontend on the same machine (or update `VITE_SOCKET_URL` / CORS origins).
- Messages are not persisted across server restarts (by design for this demo).
- No rate limiting or message length hard limits beyond basic validation.
- Browser supports WebSocket (falls back to polling via Socket.io).

## Bonus Features Implemented

- [x] Username-based login (dummy)
- [x] Typing indicator
- [x] Online/offline user status
- [x] Basic message status field (`sent` / `read`)
- [ ] Persistent DB (easy to add; currently in-memory)
- [ ] Deployed live URL (can be deployed to Render / Railway)

## Running Both Together

Open two terminals:

```bash
# Terminal 1
cd backend && npm start

# Terminal 2
cd frontend && npm run dev
```

Then open `http://localhost:5173` in multiple browser tabs.

## Tech Stack

| Layer     | Technology              |
|-----------|-------------------------|
| Frontend  | React 19, Vite, Socket.io-client |
| Backend   | Node.js, Express, Socket.io |
| Real-time | Socket.io (WebSocket + fallback) |
| Storage   | In-memory (Map + Array) |

## License

MIT — feel free to use and extend.
