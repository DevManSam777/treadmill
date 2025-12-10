let sessions = [];
let weeklyChart = null;
let monthlyChart = null;
const API_URL = '/api';

// Authentication functions
function getAuthToken() {
    return localStorage.getItem('authToken');
}

function saveAuthToken(token) {
    localStorage.setItem('authToken', token);
}

function clearAuthToken() {
    localStorage.removeItem('authToken');
}

function getAuthHeaders() {
    const token = getAuthToken();
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

async function handleLogin() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');

    if (!username || !password) {
        errorDiv.textContent = 'Please enter username and password';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (!response.ok) {
            const error = await response.json();
            errorDiv.textContent = error.error || 'Login failed';
            return;
        }

        const data = await response.json();
        saveAuthToken(data.token);
        showApp();
        init();
    } catch (error) {
        console.error('Login error:', error);
        errorDiv.textContent = 'Connection error. Please try again.';
    }
}

function handleLogout() {
    clearAuthToken();
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginError').textContent = '';
    showLogin();
}

function showLogin() {
    document.getElementById('loginForm').style.display = 'flex';
    document.getElementById('appContent').style.display = 'none';
}

function showApp() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('appContent').style.display = 'block';
}

function checkAuth() {
    const token = getAuthToken();
    if (token) {
        showApp();
        init();
    } else {
        showLogin();
    }
}

// Parse YYYY-MM-DD string as local date (not UTC)
function parseLocalDate(dateString) {
    const [year, month, day] = dateString.split('-');
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}

// Initialize
async function init() {
    try {
        const response = await fetch(`${API_URL}/sessions`, {
            headers: getAuthHeaders()
        });
        if (response.status === 401) {
            showLogin();
            return;
        }
        if (!response.ok) throw new Error('Failed to fetch sessions');
        sessions = await response.json();
    } catch (error) {
        console.error('Error fetching sessions:', error);
        sessions = [];
    }

    // Set date input to today (local timezone)
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const localDateString = `${year}-${month}-${day}`;
    document.getElementById('date').value = localDateString;

    updateDisplay();
}

async function addSession() {
    const date = document.getElementById('date').value;
    const distance = parseFloat(document.getElementById('distance').value);
    const duration = parseFloat(document.getElementById('duration').value);

    if (!date || !distance || !duration) {
        alert('Please fill in all fields');
        return;
    }

    if (distance <= 0 || duration <= 0) {
        alert('Distance and duration must be positive');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/sessions`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ date, distance, duration })
        });

        if (response.status === 401) {
            showLogin();
            return;
        }
        if (!response.ok) throw new Error('Failed to add session');

        // Refresh sessions from server
        const sessionsResponse = await fetch(`${API_URL}/sessions`, {
            headers: getAuthHeaders()
        });
        sessions = await sessionsResponse.json();

        // Clear inputs
        document.getElementById('distance').value = '';
        document.getElementById('duration').value = '';
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        document.getElementById('date').value = `${year}-${month}-${day}`;

        updateDisplay();
    } catch (error) {
        console.error('Error adding session:', error);
        alert('Error adding session. Make sure the server is running.');
    }
}

async function deleteSession(id) {
    try {
        const response = await fetch(`${API_URL}/sessions/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (response.status === 401) {
            showLogin();
            return;
        }
        if (!response.ok) throw new Error('Failed to delete session');

        // Refresh sessions from server
        const sessionsResponse = await fetch(`${API_URL}/sessions`, {
            headers: getAuthHeaders()
        });
        sessions = await sessionsResponse.json();

        updateDisplay();
    } catch (error) {
        console.error('Error deleting session:', error);
        alert('Error deleting session. Make sure the server is running.');
    }
}

function updateDisplay() {
    updateStats();
    updateTable();
    updateCharts();
}

function updateStats() {
    const totalDistance = sessions.reduce((sum, s) => sum + s.distance, 0);
    const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
    const avgDistance = sessions.length > 0 ? totalDistance / sessions.length : 0;

    // Calculate streak
    let streak = 0;
    if (sessions.length > 0) {
        const sortedByDate = [...sessions].sort((a, b) => parseLocalDate(b.date) - parseLocalDate(a.date));
        let currentDate = parseLocalDate(sortedByDate[0].date);

        for (const session of sortedByDate) {
            const sessionDate = parseLocalDate(session.date);
            const expectedDate = new Date(currentDate);

            if (expectedDate.getTime() === sessionDate.getTime() ||
                expectedDate.getTime() - sessionDate.getTime() === 86400000) {
                streak++;
                currentDate = sessionDate;
            } else {
                break;
            }
        }
    }

    // This week
    const weekStart = getWeekStart(new Date());
    const weekSessions = sessions.filter(s => parseLocalDate(s.date) >= weekStart);
    const weekTotal = weekSessions.reduce((sum, s) => sum + s.distance, 0);

    // This month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthSessions = sessions.filter(s => parseLocalDate(s.date) >= monthStart);
    const monthTotal = monthSessions.reduce((sum, s) => sum + s.distance, 0);

    document.getElementById('totalDistance').textContent = totalDistance.toFixed(1) + ' mi';
    document.getElementById('totalSessions').textContent = sessions.length;
    document.getElementById('avgDistance').textContent = avgDistance.toFixed(1) + ' mi';
    document.getElementById('streak').textContent = streak + ' days';
    document.getElementById('weekTotal').textContent = weekTotal.toFixed(1) + ' mi';
    document.getElementById('monthTotal').textContent = monthTotal.toFixed(1) + ' mi';
}

function updateTable() {
    const tbody = document.getElementById('tableBody');
    const emptyState = document.getElementById('emptyState');

    tbody.innerHTML = '';

    if (sessions.length === 0) {
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    sessions.forEach(session => {
        const speed = (session.distance / session.duration * 60).toFixed(1);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${parseLocalDate(session.date).toLocaleDateString()}</td>
            <td>${session.distance.toFixed(1)}</td>
            <td>${session.duration}</td>
            <td>${speed}</td>
            <td><button class="delete-btn" onclick="deleteSession(${session.id})">Delete</button></td>
        `;
        tbody.appendChild(row);
    });
}

function updateCharts() {
    updateWeeklyChart();
    updateMonthlyChart();
}

function updateWeeklyChart() {
    // Get last 12 weeks
    const weeks = [];
    const weekData = [];

    const today = new Date();
    const currentWeekStart = getWeekStart(today);

    for (let i = 11; i >= 0; i--) {
        const weekStart = new Date(currentWeekStart);
        weekStart.setDate(weekStart.getDate() - (i * 7));

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const weekNum = `Week ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        weeks.push(weekNum);

        const weekSessions = sessions.filter(s => {
            const sessionDate = parseLocalDate(s.date);
            return sessionDate >= weekStart && sessionDate <= weekEnd;
        });

        const total = weekSessions.reduce((sum, s) => sum + s.distance, 0);
        weekData.push(total);
    }

    const ctx = document.getElementById('weeklyChart').getContext('2d');

    if (weeklyChart) {
        weeklyChart.destroy();
    }

    weeklyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: weeks,
            datasets: [{
                label: 'Distance (miles)',
                data: weekData,
                borderColor: '#000',
                backgroundColor: 'rgba(0, 0, 0, 0.05)',
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#000',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        font: {
                            size: 10
                        },
                        padding: 10
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value + ' mi';
                        }
                    }
                }
            }
        }
    });
}

function updateMonthlyChart() {
    // Get last 12 months
    const months = [];
    const monthData = [];

    const today = new Date();
    for (let i = 11; i >= 0; i--) {
        const monthStart = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);

        months.push(monthStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));

        const monthSessions = sessions.filter(s => {
            const sessionDate = parseLocalDate(s.date);
            return sessionDate >= monthStart && sessionDate <= monthEnd;
        });

        const total = monthSessions.reduce((sum, s) => sum + s.distance, 0);
        monthData.push(total);
    }

    const ctx = document.getElementById('monthlyChart').getContext('2d');

    if (monthlyChart) {
        monthlyChart.destroy();
    }

    monthlyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [{
                label: 'Distance (miles)',
                data: monthData,
                backgroundColor: '#000',
                borderRadius: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        font: {
                            size: 10
                        },
                        padding: 10
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value + ' mi';
                        }
                    }
                }
            }
        }
    });
}

function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

// Initialize on load
checkAuth();
