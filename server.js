// server.js - ULTIMATE FIX: Clean JSON, Persistent Data, Owner Check
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// PERSISTENT IN-MEMORY DATABASE
// ============================================
const kholinUsers = new Map();      // Key: UserId, Value: { username, displayName, verified }
const likeDatabase = new Map();     // Key: TargetUserId, Value: Set of LikerIds

const OWNER_ID = "10538"; // <<< YOUR SUPER ADMIN ID HERE

console.log('[Kholin API] Starting up... (In-Memory Mode)');
app.get('/', (req, res) => res.send('Kholin API Running'));

// ============================================
// 1. REGISTER & VERIFY USER
// ============================================
app.post('/api/users/register', (req, res) => {
    try {
        let { userId, username, displayName, friendship_status, follow_status } = req.body;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });

        username = (username || 'Unknown').replace(/[\n\r]+/g, '').trim();
        displayName = (displayName || username).replace(/[\n\r]+/g, '').trim();

        const isSelf = (friendship_status === "self" && follow_status === "self");

        kholinUsers.set(userId, {
            username: username,
            displayName: displayName,
            lastSeen: new Date().toISOString(),
            verified: isSelf
        });

        res.json({ success: true, message: "User synced", verified: isSelf });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============================================
// 2. STRICT VERIFICATION & OWNER CHECK
// ============================================
app.get('/api/users/:userId/verify', (req, res) => {
    try {
        const { userId } = req.params;
        const user = kholinUsers.get(userId);
        
        const verified = !!(user && user.verified);
        const isOwner = (userId === OWNER_ID);

        res.json({ 
            verified: verified, 
            owner: isOwner  // <<< RETURN OWNER STATUS
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============================================
// 3. FETCH LIKES
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
// 4. TOGGLE LIKE
// ============================================
app.post('/stats/:userId/likes', (req, res) => {
    try {
        const { userId } = req.params;
        const { likerId } = req.body;

        if (!likerId) return res.status(400).json({ error: "Missing likerId" });
        if (userId === likerId) return res.status(403).json({ error: "Self-like blocked" });

        const liker = kholinUsers.get(likerId);
        if (!liker || !liker.verified) return res.status(403).json({ error: "Only verified users can like" });

        if (!likeDatabase.has(userId)) likeDatabase.set(userId, new Set());
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
// 5. GET ALL REGISTERED USERS
// ============================================
app.get('/api/users', (req, res) => {
    try {
        const users = Array.from(kholinUsers.entries()).map(([userId, data]) => {
            
            const usersLikedTo = [];
            for (const [targetUserId, likerSet] of likeDatabase.entries()) {
                if (likerSet.has(userId)) usersLikedTo.push(targetUserId);
            }

            const likedBy = [];
            const myLikers = likeDatabase.get(userId);
            if (myLikers) likedBy.push(...Array.from(myLikers));

            return { userId, ...data, usersLikedTo, likedBy };
        });
        res.json({ success: true, count: users.length, users });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[Kholin API] Running on port ${PORT}`));
