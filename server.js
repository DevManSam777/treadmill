const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

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

// Get all sessions
app.get('/api/sessions', (req, res) => {
  db.all('SELECT * FROM sessions ORDER BY date DESC', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

// Add a new session
app.post('/api/sessions', (req, res) => {
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
app.delete('/api/sessions/:id', (req, res) => {
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
