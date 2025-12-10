require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Authentication configuration
const AUTH_USERNAME = process.env.AUTH_USERNAME || 'admin';
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'password123';
const TOKEN_EXPIRY_DAYS = 30;

// Token storage (in memory)
const tokens = new Map();

// Helper function to generate token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Helper function to validate token
function validateToken(token) {
  if (!tokens.has(token)) return false;
  const expiry = tokens.get(token);
  if (Date.now() > expiry) {
    tokens.delete(token);
    return false;
  }
  return true;
}

// Authentication middleware
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.slice(7);
  if (!validateToken(token)) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  next();
}

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.'));

// Initialize SQLite database
const dbPath = process.env.FLY ? '/data/treadmill.db' : './data/treadmill.db';
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Create tables if they don't exist
function initializeDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      distance REAL NOT NULL,
      duration REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating table:', err);
    } else {
      console.log('Database table initialized');
    }
  });
}

// API Routes

// Login endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  if (username === AUTH_USERNAME && password === AUTH_PASSWORD) {
    const token = generateToken();
    const expiry = Date.now() + (TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    tokens.set(token, expiry);
    return res.json({ token });
  }

  res.status(401).json({ error: 'Invalid credentials' });
});

// Get all sessions
app.get('/api/sessions', requireAuth, (req, res) => {
  db.all('SELECT * FROM sessions ORDER BY date DESC', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

// Add a new session
app.post('/api/sessions', requireAuth, (req, res) => {
  const { date, distance, duration } = req.body;

  if (!date || !distance || !duration) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  db.run(
    'INSERT INTO sessions (date, distance, duration) VALUES (?, ?, ?)',
    [date, distance, duration],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ id: this.lastID, date, distance, duration });
      }
    }
  );
});

// Delete a session
app.delete('/api/sessions/:id', requireAuth, (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM sessions WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ success: true });
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve the tracker app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'tracker.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Treadmill tracker server running at http://localhost:${PORT}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});
