// server.js - No MongoDB, In-Memory Storage (Full with Verification Endpoint)
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// IN-MEMORY DATABASE (Resets on Render restart)
// ============================================
const kholinUsers = {};      // Stores verified users: { "10538": { username: "minibloxia", verified: true } }
const likeDatabase = {};     // Stores likes: { "10538": ["likerId1", "likerId2"] }

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
        
        // Store user in memory
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
// 2. CHECK IF A USER IS VERIFIED (NEW)
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
// 3. GET /stats/:userId/likes
// ============================================
app.get('/stats/:userId/likes', (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`[API] Fetching likes for user: ${userId}`);

        const likerIds = likeDatabase[userId] || [];
        const total = likerIds.length;

        res.json({ success: true, userId, count: total, likerIds });
    } catch (e) {
        console.error('[API ERROR] GET likes failed:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ============================================
// 4. POST /stats/:userId/likes (Toggle Like)
// ============================================
app.post('/stats/:userId/likes', (req, res) => {
    try {
        const { userId } = req.params;
        const { likerId } = req.body;

        if (!likerId) return res.status(400).json({ error: "Missing likerId" });
        console.log(`[API] Toggling like: Target=${userId}, Liker=${likerId}`);

        // SECURITY: Check if the liker is verified in our in-memory list
        const liker = kholinUsers[likerId];
        if (!liker || !liker.verified) {
            return res.status(403).json({ error: "Only verified Kholin users can like" });
        }

        // Initialize array if it doesn't exist
        if (!likeDatabase[userId]) {
            likeDatabase[userId] = [];
        }

        const existingLikeIndex = likeDatabase[userId].indexOf(likerId);

        if (existingLikeIndex !== -1) {
            // REMOVE LIKE
            likeDatabase[userId].splice(existingLikeIndex, 1);
            return res.json({ success: true, action: 'removed' });
        } else {
            // ADD LIKE
            likeDatabase[userId].push(likerId);
            return res.json({ success: true, action: 'added' });
        }
    } catch (e) {
        console.error('[API ERROR] POST likes failed:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ============================================
// 5. GET /stats/:userId/subscription
// ============================================
app.get('/stats/:userId/subscription', (req, res) => {
    try {
        const { userId } = req.params;
        const user = kholinUsers[userId];

        res.json({ 
            success: true, 
            userId, 
            tier: user?.subscriptionTier || 'free', 
            expiresAt: null 
        });
    } catch (e) {
        console.error('[API ERROR] Subscription failed:', e.message);
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[Kholin API] Server running on port ${PORT}`));
