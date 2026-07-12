// server.js - ULTIMATE FIX: Clean JSON, Added usersLikedTo array
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// PERSISTENT IN-MEMORY DATABASE
// ============================================
const kholinUsers = new Map();      // Key: UserId, Value: { username, verified }
const likeDatabase = new Map();     // Key: TargetUserId, Value: Set of LikerIds

console.log('[Kholin API] Starting up... (In-Memory Mode)');

app.get('/', (req, res) => res.send('Kholin API Running'));

// ============================================
// 1. REGISTER USER (Verifies User)
// ============================================
app.post('/api/users/register', (req, res) => {
    try {
        let { userId, username, displayName } = req.body;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });

        // CRITICAL FIX: Sanitize strings to remove \n and extra spaces
        username = (username || 'Unknown').replace(/[\n\r]+/g, '').trim();
        displayName = (displayName || username).replace(/[\n\r]+/g, '').trim();

        console.log(`[API] Registered/Verified User: ${userId} (${username})`);
        
        kholinUsers.set(userId, {
            username: username,
            displayName: displayName,
            lastSeen: new Date().toISOString(),
            verified: true
        });

        res.json({ success: true, message: "User verified" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============================================
// 2. CHECK VERIFICATION
// ============================================
app.get('/api/users/:userId/verify', (req, res) => {
    try {
        const { userId } = req.params;
        const user = kholinUsers.get(userId);
        res.json({ verified: !!(user && user.verified) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============================================
// 3. FETCH LIKES (PUBLIC)
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
// 4. TOGGLE LIKE (VERIFIED USERS ONLY)
// ============================================
app.post('/stats/:userId/likes', (req, res) => {
    try {
        const { userId } = req.params;
        const { likerId } = req.body;

        if (!likerId) return res.status(400).json({ error: "Missing likerId" });
        if (userId === likerId) return res.status(403).json({ error: "Self-like blocked" });

        // Security: Check if liker is verified in the Map
        const liker = kholinUsers.get(likerId);
        if (!liker || !liker.verified) {
            return res.status(403).json({ error: "Only verified users can like" });
        }

        if (!likeDatabase.has(userId)) {
            likeDatabase.set(userId, new Set());
        }
        const likerSet = likeDatabase.get(userId);

        let action = '';
        if (likerSet.has(likerId)) {
            likerSet.delete(likerId);
            action = 'removed';
        } else {
            likerSet.add(likerId);
            action = 'added';
        }

        const updatedLikerIds = Array.from(likerSet);
        console.log(`[API] Like ${action}: ${userId} by ${likerId}. Count: ${updatedLikerIds.length}`);

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

// ============================================
// 5. GET ALL REGISTERED USERS (NEW ROUTE)
// ============================================
app.get('/api/users', (req, res) => {
    try {
        // Convert the Map to a readable JSON array
        const users = Array.from(kholinUsers.entries()).map(([userId, data]) => {
            
            // CRITICAL FEATURE: Calculate the list of users THIS user has liked
            const usersLikedTo = [];
            
            // Iterate through the entire likeDatabase
            for (const [targetUserId, likerSet] of likeDatabase.entries()) {
                // If this userId is inside the likerSet, it means they liked targetUserId
                if (likerSet.has(userId)) {
                    usersLikedTo.push(targetUserId);
                }
            }

            return { 
                userId, 
                ...data,
                usersLikedTo: usersLikedTo // Add the array of liked User IDs
            };
        });
        
        res.json({ success: true, count: users.length, users });
    } catch (e) {
        console.error('[API Error] /api/users failed:', e);
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[Kholin API] Running on port ${PORT}`));
