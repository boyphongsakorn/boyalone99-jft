require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// MySQL Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'boyalone99_community',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'BoyAlone99 Backend is running' });
});

// Get all rewards from Database
app.get('/rewards', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM rewards');
    res.json(rows);
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Failed to fetch rewards' });
  }
});

// Get user balance
app.get('/balance/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const [rows] = await pool.query('SELECT balance FROM users WHERE discord_id = ?', [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ balance: rows[0].balance });
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
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
