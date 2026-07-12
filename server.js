// server.js - Deploy to Render
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb'); // Requires 'mongodb' package

const app = express();
app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI; // Set this in Render environment variables
const DB_NAME = 'kholin_stats';

app.get('/', (req, res) => res.send('Kholin API Running'));

// --- 1. REGISTER USER (Your existing logic) ---
app.post('/api/users/register', async (req, res) => {
    try {
        const { userId, username, displayName, sessionToken } = req.body;
        const client = new MongoClient(MONGO_URI);
        await client.connect();
        const db = client.db(DB_NAME);
        const collection = db.collection('kholin_users');

        // Upsert user data, marking them as "verified" (Kholin user)
        await collection.updateOne(
            { userId: userId },
            { $set: { username, displayName, lastSeen: new Date(), verified: true } },
            { upsert: true }
        );
        await client.close();
        res.json({ success: true, message: "User registered/verified" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- 2. GET /stats/:userId/likes ---
app.get('/stats/:userId/likes', async (req, res) => {
    try {
        const { userId } = req.params;
        const client = new MongoClient(MONGO_URI);
        await client.connect();
        const db = client.db(DB_NAME);
        const likesCol = db.collection('likes');
        const usersCol = db.collection('kholin_users');

        // Get total likes for this user
        const total = await likesCol.countDocuments({ targetId: userId });

        // Get list of who liked them (for the "Verified" check later)
        const likers = await likesCol.find({ targetId: userId }).toArray();
        const likerIds = likers.map(l => l.likerId);

        await client.close();
        res.json({ success: true, userId, count: total, likerIds });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- 3. POST /stats/:userId/likes (Toggle Like) ---
app.post('/stats/:userId/likes', async (req, res) => {
    try {
        const { userId } = req.params; // The person being liked
        const { likerId } = req.body; // The person clicking the button

        if (!likerId) return res.status(400).json({ error: "Missing likerId" });

        const client = new MongoClient(MONGO_URI);
        await client.connect();
        const db = client.db(DB_NAME);
        const likesCol = db.collection('likes');
        const usersCol = db.collection('kholin_users');

        // SECURITY: Check if the liker is verified (Kholin user)
        const liker = await usersCol.findOne({ userId: likerId });
        if (!liker || !liker.verified) {
            await client.close();
            return res.status(403).json({ error: "Only verified Kholin users can like" });
        }

        // Toggle logic
        const existingLike = await likesCol.findOne({ targetId: userId, likerId: likerId });
        
        if (existingLike) {
            await likesCol.deleteOne({ targetId: userId, likerId: likerId });
            await client.close();
            return res.json({ success: true, action: 'removed' });
        } else {
            await likesCol.insertOne({ targetId: userId, likerId: likerId, createdAt: new Date() });
            await client.close();
            return res.json({ success: true, action: 'added' });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- 4. GET /stats/:userId/subscription ---
app.get('/stats/:userId/subscription', async (req, res) => {
    try {
        const { userId } = req.params;
        const client = new MongoClient(MONGO_URI);
        await client.connect();
        const db = client.db(DB_NAME);
        const usersCol = db.collection('kholin_users');

        const user = await usersCol.findOne({ userId: userId });
        await client.close();

        // Default to 'free' if not found
        res.json({ 
            success: true, 
            userId, 
            tier: user?.subscriptionTier || 'free', 
            expiresAt: user?.subscriptionExpiry || null 
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
