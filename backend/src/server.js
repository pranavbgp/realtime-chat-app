const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { randomUUID: uuidv4 } = require('crypto');

const app = express();
const server = http.createServer(app);

// In-memory storage for messages and online users
const messages = [];
const onlineUsers = new Map(); // socketId -> { username, userId }

const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173'],
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Real-time Chat API is running' });
});

// REST API: Fetch chat history
app.get('/api/messages', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const history = messages.slice(-limit);
    res.json({ success: true, messages: history });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch messages' });
  }
});

// REST API: Send a message (also emits via socket for consistency)
app.post('/api/messages', (req, res) => {
  try {
    const { content, username, userId } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Message content is required' });
    }
    if (!username || !username.trim()) {
      return res.status(400).json({ success: false, error: 'Username is required' });
    }

    const message = {
      id: uuidv4(),
      content: content.trim(),
      username: username.trim(),
      userId: userId || uuidv4(),
      timestamp: new Date().toISOString(),
      status: 'sent'
    };

    messages.push(message);

    // Broadcast to all connected clients
    io.emit('new_message', message);

    res.status(201).json({ success: true, message });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

// REST API: Get online users
app.get('/api/users/online', (req, res) => {
  try {
    const users = Array.from(onlineUsers.values());
    res.json({ success: true, users });
  } catch (error) {
    console.error('Error fetching online users:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch online users' });
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // User joins with username
  socket.on('join', (data) => {
    try {
      const { username, userId } = data || {};
      if (!username || !username.trim()) {
        socket.emit('error', { message: 'Username is required to join' });
        return;
      }

      const user = {
        username: username.trim(),
        userId: userId || uuidv4(),
        socketId: socket.id,
        joinedAt: new Date().toISOString()
      };

      onlineUsers.set(socket.id, user);
      socket.user = user;

      // Notify everyone about new user
      io.emit('user_joined', {
        username: user.username,
        userId: user.userId,
        onlineCount: onlineUsers.size
      });

      // Send current online users to the new user
      socket.emit('online_users', Array.from(onlineUsers.values()));

      // Send chat history to the newly joined user
      socket.emit('chat_history', messages.slice(-100));

      console.log(`${user.username} joined. Online: ${onlineUsers.size}`);
    } catch (error) {
      console.error('Error on join:', error);
      socket.emit('error', { message: 'Failed to join chat' });
    }
  });

  // Handle incoming messages via socket
  socket.on('send_message', (data) => {
    try {
      const { content } = data || {};
      const user = socket.user;

      if (!user) {
        socket.emit('error', { message: 'You must join the chat first' });
        return;
      }

      if (!content || !content.trim()) {
        socket.emit('error', { message: 'Message content is required' });
        return;
      }

      const message = {
        id: uuidv4(),
        content: content.trim(),
        username: user.username,
        userId: user.userId,
        timestamp: new Date().toISOString(),
        status: 'sent'
      };

      messages.push(message);

      // Broadcast to all clients including sender
      io.emit('new_message', message);
    } catch (error) {
      console.error('Error sending message via socket:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Typing indicator
  socket.on('typing', (data) => {
    try {
      const user = socket.user;
      if (!user) return;

      socket.broadcast.emit('user_typing', {
        username: user.username,
        userId: user.userId,
        isTyping: data?.isTyping !== false
      });
    } catch (error) {
      console.error('Error handling typing:', error);
    }
  });

  // Stop typing
  socket.on('stop_typing', () => {
    try {
      const user = socket.user;
      if (!user) return;

      socket.broadcast.emit('user_typing', {
        username: user.username,
        userId: user.userId,
        isTyping: false
      });
    } catch (error) {
      console.error('Error handling stop typing:', error);
    }
  });

  // Message read/delivered status (basic)
  socket.on('message_read', (data) => {
    try {
      const { messageId } = data || {};
      if (messageId) {
        const msg = messages.find(m => m.id === messageId);
        if (msg) {
          msg.status = 'read';
          io.emit('message_status', { messageId, status: 'read' });
        }
      }
    } catch (error) {
      console.error('Error updating message status:', error);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    try {
      const user = onlineUsers.get(socket.id);
      if (user) {
        onlineUsers.delete(socket.id);
        io.emit('user_left', {
          username: user.username,
          userId: user.userId,
          onlineCount: onlineUsers.size
        });
        console.log(`${user.username} left. Online: ${onlineUsers.size}`);
      } else {
        console.log(`Client disconnected: ${socket.id}`);
      }
    } catch (error) {
      console.error('Error on disconnect:', error);
    }
  });

  // Error handling
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.io ready for real-time connections`);
});
