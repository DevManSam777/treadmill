const sqlite3 = require('sqlite3').verbose();
const readline = require('readline');

const db = new sqlite3.Database('./treadmill.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function showMenu() {
  console.log('\n========== TREADMILL DATABASE QUERY ==========');
  console.log('1. View all sessions');
  console.log('2. View sessions from a specific date');
  console.log('3. Get total distance');
  console.log('4. Get average distance per session');
  console.log('5. Get sessions from this week');
  console.log('6. Get sessions from this month');
  console.log('7. Exit');
  console.log('============================================\n');

  rl.question('Select an option (1-7): ', handleChoice);
}

function handleChoice(choice) {
  switch(choice) {
    case '1':
      viewAllSessions();
      break;
    case '2':
      rl.question('Enter date (YYYY-MM-DD): ', viewSessionsByDate);
      break;
    case '3':
      getTotalDistance();
      break;
    case '4':
      getAverageDistance();
      break;
    case '5':
      getWeekSessions();
      break;
    case '6':
      getMonthSessions();
      break;
    case '7':
      console.log('Goodbye!');
      db.close();
      rl.close();
      process.exit(0);
      break;
    default:
      console.log('Invalid option');
      showMenu();
  }
}

function viewAllSessions() {
  db.all('SELECT * FROM sessions ORDER BY date DESC', [], (err, rows) => {
    if (err) {
      console.error('Error:', err);
    } else {
      if (rows.length === 0) {
        console.log('\nNo sessions found.');
      } else {
        console.log('\n========== ALL SESSIONS ==========');
        rows.forEach(row => {
          console.log(`Date: ${row.date} | Distance: ${row.distance} mi | Duration: ${row.duration} min`);
        });
        console.log('==================================');
      }
    }
    showMenu();
  });
}

function viewSessionsByDate(date) {
  db.all('SELECT * FROM sessions WHERE date = ? ORDER BY date DESC', [date], (err, rows) => {
    if (err) {
      console.error('Error:', err);
    } else {
      if (rows.length === 0) {
        console.log(`\nNo sessions found for ${date}.`);
      } else {
        console.log(`\n========== SESSIONS FOR ${date} ==========`);
        rows.forEach(row => {
          console.log(`Distance: ${row.distance} mi | Duration: ${row.duration} min`);
        });
        console.log('==================================');
      }
    }
    showMenu();
  });
}

function getTotalDistance() {
  db.get('SELECT SUM(distance) as total FROM sessions', [], (err, row) => {
    if (err) {
      console.error('Error:', err);
    } else {
      console.log(`\nTotal Distance: ${row.total ? row.total.toFixed(1) : 0} miles\n`);
    }
    showMenu();
  });
}

function getAverageDistance() {
  db.get('SELECT AVG(distance) as average, COUNT(*) as count FROM sessions', [], (err, row) => {
    if (err) {
      console.error('Error:', err);
    } else {
      console.log(`\nAverage Distance: ${row.average ? row.average.toFixed(1) : 0} miles (${row.count} sessions)\n`);
    }
    showMenu();
  });
}

function getWeekSessions() {
  db.all("SELECT * FROM sessions WHERE date >= date('now', '-7 days') ORDER BY date DESC", [], (err, rows) => {
    if (err) {
      console.error('Error:', err);
    } else {
      const total = rows.reduce((sum, row) => sum + row.distance, 0);
      console.log(`\n========== THIS WEEK ==========`);
      if (rows.length === 0) {
        console.log('No sessions this week.');
      } else {
        rows.forEach(row => {
          console.log(`${row.date}: ${row.distance} mi in ${row.duration} min`);
        });
        console.log(`Total: ${total.toFixed(1)} miles`);
      }
      console.log('================================\n');
    }
    showMenu();
  });
}

function getMonthSessions() {
  db.all("SELECT * FROM sessions WHERE date >= date('now', 'start of month') ORDER BY date DESC", [], (err, rows) => {
    if (err) {
      console.error('Error:', err);
    } else {
      const total = rows.reduce((sum, row) => sum + row.distance, 0);
      console.log(`\n========== THIS MONTH ==========`);
      if (rows.length === 0) {
        console.log('No sessions this month.');
      } else {
        rows.forEach(row => {
          console.log(`${row.date}: ${row.distance} mi in ${row.duration} min`);
        });
        console.log(`Total: ${total.toFixed(1)} miles`);
      }
      console.log('================================\n');
    }
    showMenu();
  });
}

console.log('Connecting to database...');
showMenu();
