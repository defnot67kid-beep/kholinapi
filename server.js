// server.js - FIXED: No reset bug, Verified only likes, Compound key storage
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// IN-MEMORY DATABASE (FIXED STRUCTURE)
// ============================================
const kholinUsers = {};      // { "10538": { username: "minibloxia", verified: true } }

// FIX: Use a Map to store likes as a Set of liker IDs per target.
// This avoids the "overwrite" bug completely.
const likeDatabase = new Map(); 

console.log('[Kholin API] Starting up... (In-Memory Mode)');

app.get('/', (req, res) => res.send('Kholin API Running (In-Memory)'));

// ============================================
// 1. REGISTER USER (Adds/Updates user to memory)
// ============================================
app.post('/api/users/register', (req, res) => {
    try {
        const { userId, username, displayName } = req.body;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });

        console.log(`[API] Registering/Verifying user: ${userId} (${username})`);
        
        kholinUsers[userId] = {
            username: username || 'Unknown',
            displayName: displayName || username || 'Unknown',
            lastSeen: new Date().toISOString(),
            verified: true
        };

        res.json({ success: true, message: "User registered/verified" });
    } catch (e) {
        console.error('[API ERROR] Register failed:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ============================================
// 2. CHECK IF A USER IS VERIFIED
// ============================================
app.get('/api/users/:userId/verify', (req, res) => {
    try {
        const { userId } = req.params;
        const user = kholinUsers[userId];
        
        if (user && user.verified) {
            res.json({ verified: true });
        } else {
            res.json({ verified: false });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============================================
// 3. GET /stats/:userId/likes (FETCH)
// ============================================
app.get('/stats/:userId/likes', (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`[API] Fetching likes for user: ${userId}`);

        // FIX: Use a Set from the Map to ensure no duplicates
        let likerSet = likeDatabase.get(userId);
        if (!likerSet) {
            likerSet = new Set();
            likeDatabase.set(userId, likerSet);
        }

        const likerIds = Array.from(likerSet);
        const total = likerIds.length;

        res.json({ success: true, userId, count: total, likerIds });
    } catch (e) {
        console.error('[API ERROR] GET likes failed:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ============================================
// 4. POST /stats/:userId/likes (TOGGLE - FIXED)
// ============================================
app.post('/stats/:userId/likes', (req, res) => {
    try {
        const { userId } = req.params;
        const { likerId } = req.body;

        if (!likerId) return res.status(400).json({ error: "Missing likerId" });
        console.log(`[API] Toggling like: Target=${userId}, Liker=${likerId}`);

        // SECURITY: Check if the liker is verified
        const liker = kholinUsers[likerId];
        if (!liker || !liker.verified) {
            return res.status(403).json({ error: "Only verified Kholin users can like" });
        }

        // Prevent self-liking on the server side as well
        if (userId === likerId) {
            return res.status(403).json({ error: "You cannot like your own profile" });
        }

        // FIX: Use a Set from the Map to guarantee data integrity
        let likerSet = likeDatabase.get(userId);
        if (!likerSet) {
            likerSet = new Set();
            likeDatabase.set(userId, likerSet);
        }

        // TOGGLE logic using Set (which handles duplicates automatically)
        if (likerSet.has(likerId)) {
            likerSet.delete(likerId);
            console.log(`[API] Removed like from ${userId} by ${likerId}`);
            return res.json({ success: true, action: 'removed' });
        } else {
            likerSet.add(likerId);
            console.log(`[API] Added like to ${userId} by ${likerId}`);
            return res.json({ success: true, action: 'added' });
        }
    } catch (e) {
        console.error('[API ERROR] POST likes failed:', e.message);
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[Kholin API] Server running on port ${PORT}`));
