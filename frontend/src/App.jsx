import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

function App() {
  const [username, setUsername] = useState('');
  const [inputUsername, setInputUsername] = useState('');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [error, setError] = useState('');
  const [userId] = useState(() => localStorage.getItem('chat_userId') || crypto.randomUUID());

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  // Persist userId
  useEffect(() => {
    localStorage.setItem('chat_userId', userId);
  }, [userId]);

  // Scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Connect socket when username is set
  useEffect(() => {
    if (!username) return;

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setError('');
      socket.emit('join', { username, userId });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('Connection error:', err);
      setError('Unable to connect to server. Make sure the backend is running.');
      setIsConnected(false);
    });

    socket.on('chat_history', (history) => {
      setMessages(Array.isArray(history) ? history : []);
    });

    socket.on('new_message', (message) => {
      setMessages((prev) => {
        // Avoid duplicates
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
    });

    socket.on('online_users', (users) => {
      setOnlineUsers(Array.isArray(users) ? users : []);
    });

    socket.on('user_joined', (data) => {
      setOnlineUsers((prev) => {
        if (prev.some((u) => u.userId === data.userId)) return prev;
        return [...prev, { username: data.username, userId: data.userId }];
      });
    });

    socket.on('user_left', (data) => {
      setOnlineUsers((prev) => prev.filter((u) => u.userId !== data.userId));
    });

    socket.on('user_typing', (data) => {
      if (data.userId === userId) return;
      setTypingUsers((prev) => {
        if (data.isTyping) {
          if (prev.some((u) => u.userId === data.userId)) return prev;
          return [...prev, { username: data.username, userId: data.userId }];
        }
        return prev.filter((u) => u.userId !== data.userId);
      });
    });

    socket.on('error', (data) => {
      setError(data?.message || 'An error occurred');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [username, userId]);

  const handleJoin = (e) => {
    e.preventDefault();
    const name = inputUsername.trim();
    if (name.length < 2) {
      setError('Username must be at least 2 characters');
      return;
    }
    if (name.length > 20) {
      setError('Username must be 20 characters or less');
      return;
    }
    setError('');
    setUsername(name);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    const content = newMessage.trim();
    if (!content || !socketRef.current || !isConnected) return;

    socketRef.current.emit('send_message', { content });
    setNewMessage('');

    // Stop typing
    if (isTypingRef.current) {
      socketRef.current.emit('stop_typing');
      isTypingRef.current = false;
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);

    if (!socketRef.current || !isConnected) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socketRef.current.emit('typing', { isTyping: true });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (isTypingRef.current && socketRef.current) {
        socketRef.current.emit('stop_typing');
        isTypingRef.current = false;
      }
    }, 1500);
  };

  const formatTime = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatDate = (isoString) => {
    try {
      const date = new Date(isoString);
      const today = new Date();
      if (date.toDateString() === today.toDateString()) return 'Today';
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
      return date.toLocaleDateString();
    } catch {
      return '';
    }
  };

  // Login screen
  if (!username) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <h1>💬 Real-time Chat</h1>
            <p>Enter a username to join the conversation</p>
          </div>
          <form onSubmit={handleJoin} className="login-form">
            <input
              type="text"
              value={inputUsername}
              onChange={(e) => setInputUsername(e.target.value)}
              placeholder="Your username"
              maxLength={20}
              autoFocus
              className="login-input"
            />
            {error && <p className="error-text">{error}</p>}
            <button type="submit" className="login-btn">
              Join Chat
            </button>
          </form>
          <p className="login-hint">No account needed — just pick a name</p>
        </div>
      </div>
    );
  }

  // Main chat UI
  return (
    <div className="chat-app">
      <header className="chat-header">
        <div className="header-left">
          <h1>💬 Chat Room</h1>
          <span className={`status-badge ${isConnected ? 'online' : 'offline'}`}>
            {isConnected ? 'Connected' : 'Reconnecting...'}
          </span>
        </div>
        <div className="header-right">
          <span className="online-count">{onlineUsers.length} online</span>
          <span className="current-user">You: {username}</span>
        </div>
      </header>

      <div className="chat-body">
        <aside className="sidebar">
          <h3>Online Users</h3>
          <ul className="user-list">
            {onlineUsers.map((user) => (
              <li key={user.userId} className={user.userId === userId ? 'me' : ''}>
                <span className="user-dot" />
                {user.username}
                {user.userId === userId && ' (you)'}
              </li>
            ))}
            {onlineUsers.length === 0 && <li className="empty">No users online</li>}
          </ul>
        </aside>

        <main className="messages-area">
          {error && (
            <div className="error-banner">
              {error}
              <button onClick={() => setError('')}>×</button>
            </div>
          )}

          <div className="messages-list">
            {messages.length === 0 && (
              <div className="empty-state">
                <p>No messages yet. Say hello! 👋</p>
              </div>
            )}

            {messages.map((msg, index) => {
              const isOwn = msg.userId === userId;
              const showDate =
                index === 0 ||
                formatDate(messages[index - 1].timestamp) !== formatDate(msg.timestamp);

              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="date-separator">
                      <span>{formatDate(msg.timestamp)}</span>
                    </div>
                  )}
                  <div className={`message ${isOwn ? 'own' : 'other'}`}>
                    {!isOwn && <div className="message-username">{msg.username}</div>}
                    <div className="message-bubble">
                      <p className="message-content">{msg.content}</p>
                      <span className="message-time">{formatTime(msg.timestamp)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {typingUsers.length > 0 && (
            <div className="typing-indicator">
              {typingUsers.map((u) => u.username).join(', ')}
              {typingUsers.length === 1 ? ' is' : ' are'} typing...
            </div>
          )}

          <form onSubmit={handleSendMessage} className="message-form">
            <input
              type="text"
              value={newMessage}
              onChange={handleTyping}
              placeholder={isConnected ? 'Type a message...' : 'Connecting...'}
              disabled={!isConnected}
              className="message-input"
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={!isConnected || !newMessage.trim()}
              className="send-btn"
            >
              Send
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}

export default App;
