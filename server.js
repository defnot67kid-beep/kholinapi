// server.js - Kholin User Verification API
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// ============================================
// DATABASE (In-Memory for testing)
// Replace this with a real database (MongoDB, SQLite) later.
// ============================================
const kholinUsers = new Map();

// Add your own User ID here so you get the badge!
kholinUsers.set('10538', { 
    username: 'minibloxia', 
    joined: '2026-04-23',
    isKholin: true 
});

// ============================================
// ROUTES
// ============================================

// Root endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'online', 
        message: 'Kholin API is running',
        endpoints: ['GET /verify/:userId', 'POST /register']
    });
});

// 1. VERIFY USER (Public Endpoint)
// Checks if a specific user ID is a Kholin member.
app.get('/verify/:userId', (req, res) => {
    const userId = req.params.userId;
    
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    // Check the database
    const user = kholinUsers.get(userId);
    
    if (user && user.isKholin) {
        return res.json({ 
            userId: userId, 
            isKholin: true, 
            username: user.username 
        });
    } else {
        return res.json({ 
            userId: userId, 
            isKholin: false 
        });
    }
});

// 2. REGISTER/LOGIN (Private - Used by the extension)
// When a user installs the extension, they send their data here.
app.post('/register', (req, res) => {
    const { userId, username, displayName } = req.body;

    if (!userId || !username) {
        return res.status(400).json({ error: 'Missing userId or username' });
    }

    // Save user to database (Update if exists, Add if new)
    kholinUsers.set(userId, {
        username: username,
        displayName: displayName || username,
        joined: new Date().toISOString(),
        isKholin: true  // By default, anyone who registers via extension is a Kholin user
    });

    console.log(`[Kholin API] Registered/Updated user: ${username} (ID: ${userId})`);
    
    return res.json({ 
        success: true, 
        message: 'User registered successfully',
        isKholin: true 
    });
});

// 3. GET ALL KHOLIN USERS (For debugging)
app.get('/users', (req, res) => {
    const users = Array.from(kholinUsers.entries()).map(([id, data]) => ({
        id: id,
        username: data.username,
        isKholin: data.isKholin
    }));
    res.json({ count: users.length, users: users });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
    console.log(`[Kholin API] Server running on port ${PORT}`);
});
