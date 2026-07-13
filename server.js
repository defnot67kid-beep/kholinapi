// server.js - SECURE KEY SYSTEM: Generates unique keys, Admin check via is_admin
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// PERSISTENT IN-MEMORY DATABASE
// ============================================
const kholinUsers = new Map();      // Key: UserId, Value: { username, verified, secret_key, is_admin, bio }
const likeDatabase = new Map();     // Key: TargetUserId, Value: Set of LikerIds

console.log('[Kholin API] Starting up... (In-Memory Mode)');
app.get('/', (req, res) => res.send('Kholin API Running'));

// Helper to generate a unique key
function generateSecretKey() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    const length = 64;
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// ============================================
// 1. REGISTER & VERIFY USER (Generates Secret Key)
// ============================================
app.post('/api/users/register', (req, res) => {
    try {
        let { userId, username, displayName, friendship_status, follow_status } = req.body;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });

        username = (username || 'Unknown').replace(/[\n\r]+/g, '').trim();
        displayName = (displayName || username).replace(/[\n\r]+/g, '').trim();

        const isSelf = (friendship_status === "self" && follow_status === "self");

        // IMPORTANT: Generate a unique secret key for this user
        const secret_key = generateSecretKey();
        
        // IMPORTANT: Hardcode Admin access to ID 10538
        const is_admin = (userId === "10538");

        // Store user data
        const userData = {
            username: username,
            displayName: displayName,
            lastSeen: new Date().toISOString(),
            verified: isSelf,
            secret_key: secret_key,
            is_admin: is_admin,
            bio: "" // Initialize empty bio
        };

        kholinUsers.set(userId, userData);

        console.log(`[API] Registered User: ${userId} | Admin: ${is_admin} | Key: ${secret_key.substring(0, 8)}...`);

        res.json({ 
            success: true, 
            message: "User synced", 
            verified: isSelf, 
            secret_key: secret_key, // Return the key to the client
            is_admin: is_admin 
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============================================
// 2. STRICT VERIFICATION & ADMIN CHECK
// ============================================
app.get('/api/users/:userId/verify', (req, res) => {
    try {
        const { userId } = req.params;
        const user = kholinUsers.get(userId);
        
        if (!user) {
            return res.json({ verified: false, admin: false });
        }
        
        res.json({ 
            verified: user.verified === true, 
            admin: user.is_admin === true // Check the database flag
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
// 5. GET ALL REGISTERED USERS (Secure: Hides secret keys)
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

            // DO NOT return the secret_key or bio in this public endpoint
            return { userId, ...data, secret_key: undefined, bio: undefined };
        });
        res.json({ success: true, count: users.length, users });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ============================================
// 6. GET & UPDATE USER BIO (Stored in Kholin DB)
// ============================================
app.get('/api/users/:userId/bio', (req, res) => {
    const { userId } = req.params;
    const user = kholinUsers.get(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ success: true, bio: user.bio || "" });
});

app.post('/api/users/:userId/bio', (req, res) => {
    try {
        const { userId } = req.params;
        const { bio } = req.body;

        if (!kholinUsers.has(userId)) {
            return res.status(404).json({ error: "User not found" });
        }

        const user = kholinUsers.get(userId);
        user.bio = bio.substring(0, 1000); // Enforce 1000 char limit
        kholinUsers.set(userId, user);

        console.log(`[API] Bio updated for ${userId}: "${bio.substring(0, 30)}..."`);
        res.json({ success: true, message: "Bio updated successfully" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[Kholin API] Running on port ${PORT}`));
