require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const mysql = require('mysql2/promise');
const otplib = require('otplib');
const qrcode = require('qrcode');

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

// Middleware to check Admin Auth
const checkAdminAuth = (req, res, next) => {
  const token = req.headers['x-admin-token'];
  if (token === 'authenticated') {
    next();
  } else {
    res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
};

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

app.get('/admin/auth/status', async (req, res) => {
  const secret = process.env.ADMIN_2FA_SECRET;
  if (secret) {
    res.json({ hasSecret: true });
  } else {
    res.json({ hasSecret: false });
  }
});

app.get('/admin/auth/qr', async (req, res) => {
  try {
    const secret = process.env.ADMIN_2FA_SECRET;
    if (!secret) return res.status(500).json({ error: '2FA secret not configured' });
    // const otpauth = otplib.authenticator.keyuri('BoyAlone99 Admin', 'admin@boyalone99', secret);
    const otpauth = otplib.generateURI({
        issuer: "BoyAlone99 Admin",
        label: "admin@boyalone99",
        secret,
    });
    const qrImageUrl = await qrcode.toDataURL(otpauth);
    res.json({ qrCode: qrImageUrl });
  } catch (error) {
    console.error('QR Generation Error:', error);
    res.status(500).json({ error: 'Failed to generate QR' });
  }
});

app.post('/admin/auth/verify', async (req, res) => {
  try {
    const { token } = req.body;
    const secret = process.env.ADMIN_2FA_SECRET;
    if (!secret) return res.status(500).json({ error: '2FA secret not configured' });
    // const isValid = otplib.authenticator.check(token, secret);
    const isValid = await otplib.verify({ secret, token });
    if (isValid) {
      res.json({ success: true, adminToken: 'authenticated' });
    } else {
      res.status(401).json({ error: 'Invalid OTP token' });
    }
  } catch (error) {
    console.error('Verification Error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ---- Admin APIs (Protected) ----

// List all users
app.get('/admin/users', checkAdminAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, username, email, avatar, alone_coin, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Add coin to user
app.post('/admin/users/:id/coins', checkAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, reason } = req.body;
    const coins = Number(amount);
    if (!Number.isInteger(coins) || coins === 0) {
      return res.status(400).json({ error: 'amount must be a non-zero integer' });
    }
    await pool.query('UPDATE users SET alone_coin = alone_coin + ? WHERE id = ?', [coins, id]);
    await pool.query('INSERT INTO coin_history (user_id, amount, reason) VALUES (?, ?, ?)', [
      id,
      coins,
      reason || 'admin adjustment',
    ]);
    const [rows] = await pool.query('SELECT alone_coin FROM users WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ balance: rows[0].alone_coin });
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Failed to add coins' });
  }
});

// Create reward
app.post('/admin/rewards', checkAdminAuth, async (req, res) => {
  try {
    const { title, description, cost, accent, icon, stock } = req.body;
    if (!title || cost === undefined) return res.status(400).json({ error: 'title and cost required' });
    const [result] = await pool.query(
      'INSERT INTO rewards (title, description, cost, accent, icon, stock) VALUES (?, ?, ?, ?, ?, ?)',
      [title, description || '', Number(cost) || 0, accent || 'peach', icon || '✦', Number(stock) || 0]
    );
    const [rows] = await pool.query('SELECT * FROM rewards WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Failed to create reward' });
  }
});

// Update reward
app.put('/admin/rewards/:id', checkAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, cost, accent, icon, stock } = req.body;
    await pool.query(
      'UPDATE rewards SET title = ?, description = ?, cost = ?, accent = ?, icon = ?, stock = ? WHERE id = ?',
      [title, description || '', Number(cost) || 0, accent || 'peach', icon || '✦', Number(stock) || 0, id]
    );
    const [rows] = await pool.query('SELECT * FROM rewards WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Reward not found' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Failed to update reward' });
  }
});

// Delete reward
app.delete('/admin/rewards/:id', checkAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM rewards WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Failed to delete reward' });
  }
});

// Redemption history
app.get('/admin/redemptions', checkAdminAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT h.id, h.redeemed_at, u.username, u.id AS user_id, r.title AS reward_title
       FROM redemption_history h
       LEFT JOIN users u ON u.id = h.user_id
       LEFT JOIN rewards r ON r.id = h.reward_id
       ORDER BY h.redeemed_at DESC LIMIT 100`
    );
    res.json(rows);
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Failed to fetch redemptions' });
  }
});

// Coin history
app.get('/admin/coin-history', checkAdminAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT h.id, h.amount, h.reason, h.created_at, u.username, u.id AS user_id
       FROM coin_history h
       LEFT JOIN users u ON u.id = h.user_id
       ORDER BY h.created_at DESC LIMIT 100`
    );
    res.json(rows);
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Failed to fetch coin history' });
  }
});

// Get user balance
app.get('/balance/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const [rows] = await pool.query('SELECT alone_coin FROM users WHERE id = ?', [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ balance: rows[0].alone_coin });
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

    // 3. Save/Update user in MySQL
    await pool.query(
      `INSERT INTO users (id, username, email, avatar, alone_coin)
       VALUES (?, ?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE username = VALUES(username), email = VALUES(email), avatar = VALUES(avatar)`,
      [discordUser.id, discordUser.username, discordUser.email || null, discordUser.avatar || null]
    );

    // 4. Send profile back to frontend
    res.json({
      username: discordUser.username,
      avatar: discordUser.avatar,
      id: discordUser.id,
      email: discordUser.email || null,
    });
  } catch (error) {
    console.error('Discord Auth Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
