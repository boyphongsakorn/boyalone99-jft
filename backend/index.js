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

// OAuth Callback Handler
app.get('/auth/discord/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).json({ error: 'Missing code' });

  try {
    // 1. Exchange code for access token
    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: process.env.REDIRECT_URI || 'https://neon-granita-d423fd.netlify.app/login/callback',
    }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

    const accessToken = tokenResponse.data.access_token;

    // 2. Fetch user profile from Discord using the token
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const discordUser = userResponse.data;

    // 3. Mock DB: Save/Update user
    users[discordUser.id] = {
      username: discordUser.username,
      avatar: discordUser.avatar,
      email: discordUser.email,
    };

    // 4. Send profile back to frontend
    res.json({ 
      username: discordUser.username, 
      avatar: discordUser.avatar, 
      id: discordUser.id 
    });
  } catch (error) {
    console.error('Discord Auth Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
