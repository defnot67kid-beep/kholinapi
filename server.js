// server.js - FIXED: Perfect toggle, no resets, Map/Set storage
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// IN-MEMORY DATABASE
// ============================================
const kholinUsers = {};      // { "10538": { username: "minibloxia", verified: true } }
const likeDatabase = new Map(); // Key: TargetUserId, Value: Set of LikerIds

console.log('[Kholin API] Starting up... (In-Memory Mode)');

app.get('/', (req, res) => res.send('Kholin API Running (In-Memory)'));

// ============================================
// 1. REGISTER USER
// ============================================
app.post('/api/users/register', (req, res) => {
    try {
        const { userId, username, displayName } = req.body;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });

        kholinUsers[userId] = {
            username: username || 'Unknown',
            displayName: displayName || username || 'Unknown',
            lastSeen: new Date().toISOString(),
            verified: true
        };
        res.json({ success: true, message: "User registered/verified" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============================================
// 2. VERIFY USER
// ============================================
app.get('/api/users/:userId/verify', (req, res) => {
    try {
        const { userId } = req.params;
        const user = kholinUsers[userId];
        res.json({ verified: !!(user && user.verified) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============================================
// 3. GET LIKES
// ============================================
app.get('/stats/:userId/likes', (req, res) => {
    try {
        const { userId } = req.params;
        const likerSet = likeDatabase.get(userId) || new Set();
        const likerIds = Array.from(likerSet);
        res.json({ success: true, userId, count: likerIds.length, likerIds });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============================================
// 4. TOGGLE LIKE (FIXED LOGIC)
// ============================================
app.post('/stats/:userId/likes', (req, res) => {
    try {
        const { userId } = req.params;
        const { likerId } = req.body;

        if (!likerId) return res.status(400).json({ error: "Missing likerId" });
        if (userId === likerId) return res.status(403).json({ error: "Cannot like yourself" });

        // Security: Check if liker is verified
        if (!kholinUsers[likerId] || !kholinUsers[likerId].verified) {
            return res.status(403).json({ error: "Only verified Kholin users can like" });
        }

        // Ensure the target has a Set
        if (!likeDatabase.has(userId)) {
            likeDatabase.set(userId, new Set());
        }
        const likerSet = likeDatabase.get(userId);

        // TOGGLE: If exists, remove. If not, add.
        let action = '';
        if (likerSet.has(likerId)) {
            likerSet.delete(likerId);
            action = 'removed';
        } else {
            likerSet.add(likerId);
            action = 'added';
        }

        // Return the NEW STATE immediately so the client can sync perfectly
        const updatedLikerIds = Array.from(likerSet);
        console.log(`[API] Like ${action}: Target=${userId}, Liker=${likerId}. New Count: ${updatedLikerIds.length}`);

        res.json({ 
            success: true, 
            action: action,
            count: updatedLikerIds.length,
            likerIds: updatedLikerIds
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[Kholin API] Server running on port ${PORT}`));
