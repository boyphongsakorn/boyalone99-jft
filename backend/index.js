require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const mysql = require('mysql2/promise');
const otplib = require('otplib');
const qrcode = require('qrcode');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

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

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || crypto.randomBytes(32).toString('hex');

// Middleware to check Admin Auth
const checkAdminAuth = (req, res, next) => {
  const token = req.headers['x-admin-token'];
  if (!token) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  try {
    jwt.verify(token, ADMIN_JWT_SECRET);
    next();
  } catch (e) {
    return res.status(403).json({ error: 'Forbidden: Invalid or expired admin token' });
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
      const adminToken = jwt.sign({ role: 'admin' }, ADMIN_JWT_SECRET, { expiresIn: '12h' });
      res.json({ success: true, adminToken });
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

// OAuth Callback Handler - Twitch (login or link)
app.get('/auth/twitch/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).json({ error: 'Missing code' });
  try {
    const redirectUri = req.query.redirect_uri || process.env.TWITCH_REDIRECT_URI || 'http://localhost:4200/login/callback';
    const tokenResponse = await axios.post('https://id.twitch.tv/oauth2/token', new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      code: String(code),
      grant_type: 'authorization_code',
      redirect_uri: String(redirectUri),
    }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    const accessToken = tokenResponse.data.access_token;
    const userResponse = await axios.get('https://api.twitch.tv/helix/users', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Client-Id': process.env.TWITCH_CLIENT_ID,
      },
    });
    const twitchUser = userResponse.data?.data?.[0];
    if (!twitchUser) return res.status(500).json({ error: 'Failed to fetch Twitch profile' });
    // If link mode (main user id passed), attach twitch to existing user
    const linkUserId = req.query.linkUserId ? String(req.query.linkUserId) : null;
    if (linkUserId) {
      await pool.query(
        'UPDATE users SET twitch_id = ?, twitch_username = ? WHERE id = ?',
        [twitchUser.id, twitchUser.login, linkUserId]
      );
      return res.json({
        id: linkUserId,
        twitch_id: twitchUser.id,
        twitch_username: twitchUser.login,
        linked: true,
        provider: 'twitch',
      });
    }
    // Login mode: use twitch:ID as primary key
    const userId = `twitch:${twitchUser.id}`;
    await pool.query(
      `INSERT INTO users (id, username, email, avatar, alone_coin, twitch_id, twitch_username)
       VALUES (?, ?, ?, ?, 0, ?, ?)
       ON DUPLICATE KEY UPDATE username = VALUES(username), email = VALUES(email), avatar = VALUES(avatar), twitch_id = VALUES(twitch_id), twitch_username = VALUES(twitch_username)`,
      [userId, twitchUser.display_name || twitchUser.login, twitchUser.email || null, twitchUser.profile_image_url || null, twitchUser.id, twitchUser.login]
    );
    res.json({
      username: twitchUser.display_name || twitchUser.login,
      avatar: null,
      avatarUrl: twitchUser.profile_image_url || null,
      id: userId,
      email: twitchUser.email || null,
      provider: 'twitch',
      twitch_id: twitchUser.id,
      twitch_username: twitchUser.login,
    });
  } catch (error) {
    console.error('Twitch Auth Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Twitch authentication failed' });
  }
});

// Unlink Twitch from main account
app.delete('/auth/twitch/link', async (req, res) => {
  try {
    const userId = req.query.userId ? String(req.query.userId) : null;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    await pool.query('UPDATE users SET twitch_id = NULL, twitch_username = NULL WHERE id = ?', [userId]);
    res.json({ ok: true });
  } catch (error) {
    console.error('Twitch Unlink Error:', error.message);
    res.status(500).json({ error: 'Failed to unlink Twitch' });
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
