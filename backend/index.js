require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Mock user database
const users = {};

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'BoyAlone99 Backend is running' });
});

// OAuth Callback Handler (Placeholder for the logic we discussed)
app.get('/auth/discord/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).json({ error: 'Missing code' });

  try {
    // 1. Exchange code for access token
    // 2. Fetch user profile from Discord
    // 3. Save/Update user in DB
    // 4. Send profile back to frontend
    res.json({ 
      username: 'BoyAlone99_Fan', 
      avatar: 'a_b_c_d', 
      id: '1234567890' 
    });
  } catch (error) {
    res.status(500).json({ error: 'Authentication failed' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
