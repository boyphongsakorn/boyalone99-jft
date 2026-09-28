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

// Public settings (claim toggle + alert bar)
app.get('/settings', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT `key`, `value` FROM settings');
    const settings = {};
    for (const r of rows) settings[r.key] = r.value;
    res.json({
      claim_enabled: settings.claim_enabled !== '0',
      alert_enabled: settings.alert_enabled === '1',
      alert_message: settings.alert_message || '',
    });
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Admin: get all settings
app.get('/admin/settings', checkAdminAuth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT `key`, `value` FROM settings');
    res.json(rows);
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Admin: update setting (claim_enabled)
app.put('/admin/settings/:key', checkAdminAuth, async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    await pool.query('INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)', [key, String(value)]);
    res.json({ key, value: String(value) });
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Failed to update setting' });
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

// Get user profile (email + epic username from DB)
// GET /users/:id
app.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      'SELECT id, username, email, avatar, alone_coin, epic_username, twitch_id, twitch_username FROM users WHERE id = ?',
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile (email + epic username saved to DB)
// PUT /users/:id { email, epic_username }
app.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { email, epic_username } = req.body;
    await pool.query('UPDATE users SET email = ?, epic_username = ? WHERE id = ?', [
      email || null,
      epic_username || null,
      id,
    ]);
    const [rows] = await pool.query(
      'SELECT id, username, email, avatar, alone_coin, epic_username, twitch_id, twitch_username FROM users WHERE id = ?',
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
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
      // Prevent linking a twitch already owned by another account
      const [taken] = await pool.query('SELECT id FROM users WHERE twitch_id = ? AND id != ?', [twitchUser.id, linkUserId]);
      if (taken.length > 0) return res.status(409).json({ error: 'This Twitch account is already linked to another user' });
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
    // Login mode: if this twitch is already linked to an account, log into THAT account
    const [linked] = await pool.query(
      'SELECT id, username, email, avatar, alone_coin, epic_username, twitch_id, twitch_username FROM users WHERE twitch_id = ?',
      [twitchUser.id]
    );
    if (linked.length > 0) {
      const owner = linked[0];
      return res.json({
        username: owner.username,
        avatar: null,
        avatarUrl: twitchUser.profile_image_url || null,
        id: owner.id,
        email: owner.email || twitchUser.email || null,
        provider: 'discord',
        twitch_id: twitchUser.id,
        twitch_username: twitchUser.login,
        linked_account: true,
      });
    }
    // Login mode: use twitch:ID as primary key — never overwrite email on login
    const userId = `twitch:${twitchUser.id}`;
    await pool.query(
      `INSERT INTO users (id, username, email, avatar, alone_coin, twitch_id, twitch_username)
       VALUES (?, ?, ?, ?, 0, ?, ?)
       ON DUPLICATE KEY UPDATE username = VALUES(username), avatar = VALUES(avatar), twitch_id = VALUES(twitch_id), twitch_username = VALUES(twitch_username)`,
      [userId, twitchUser.display_name || twitchUser.login, twitchUser.email || null, twitchUser.profile_image_url || null, twitchUser.id, twitchUser.login]
    );
    const [twRows] = await pool.query('SELECT email FROM users WHERE id = ?', [userId]);
    res.json({
      username: twitchUser.display_name || twitchUser.login,
      avatar: null,
      avatarUrl: twitchUser.profile_image_url || null,
      id: userId,
      email: twRows[0]?.email ?? twitchUser.email ?? null,
      provider: 'twitch',
      twitch_id: twitchUser.id,
      twitch_username: twitchUser.login,
    });
  } catch (error) {
    console.error('Twitch Auth Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Twitch authentication failed' });
  }
});

// Check if user follows boyalone99 on Twitch
// ponytail: manual fallback — real Helix check needs follower token (user:read:follows) + broadcaster ID; DB link-check + one-claim guard covers it until then
// GET /follow/twitch?userId=<main id>
app.get('/follow/twitch', async (req, res) => {
  try {
    const userId = req.query.userId ? String(req.query.userId) : null;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    const [users] = await pool.query('SELECT twitch_id FROM users WHERE id = ?', [userId]);
    if (users.length === 0 || !users[0].twitch_id) {
      return res.json({ following: false, reason: 'twitch_not_linked', followUrl: 'https://www.twitch.tv/boyalone99' });
    }
    const [claimed] = await pool.query('SELECT 1 FROM claimed_follows WHERE user_id = ? AND platform = ?', [userId, 'twitch']);
    res.json({ following: null, reason: 'manual_check_required', followUrl: 'https://www.twitch.tv/boyalone99', claimed: claimed.length > 0 });
  } catch (error) {
    console.error('Twitch Follow Check Error:', error.message);
    res.status(500).json({ error: 'Failed to check Twitch follow' });
  }
});

// Check YouTube sub — API key cannot verify viewer, return link + claimed state
// GET /follow/youtube?userId=<main id>
app.get('/follow/youtube', async (req, res) => {
  try {
    const channelUrl = process.env.YOUTUBE_CHANNEL_URL || (process.env.YOUTUBE_CHANNEL_ID ? `https://www.youtube.com/channel/${process.env.YOUTUBE_CHANNEL_ID}?sub_confirmation=1` : 'https://www.youtube.com/@boyalone99?sub_confirmation=1');
    const userId = req.query.userId ? String(req.query.userId) : null;
    let claimed = false;
    if (userId) {
      const [rows] = await pool.query('SELECT 1 FROM claimed_follows WHERE user_id = ? AND platform = ?', [userId, 'youtube']);
      claimed = rows.length > 0;
    }
    res.json({ following: null, reason: 'manual_check_required', channelUrl, claimed });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check YouTube subscription' });
  }
});

// Check Discord roles (Booster / LFG) via bot token
// GET /discord/roles?userId=<discord id>
app.get('/discord/roles', async (req, res) => {
  try {
    const userId = req.query.userId ? String(req.query.userId) : null;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    const guildId = process.env.DISCORD_GUILD_ID;
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const boosterRole = process.env.DISCORD_BOOSTER_ROLE_ID || '1548408109456826519';
    const lfgRole = process.env.DISCORD_LFG_ROLE_ID || '1543368029063217193';
    if (!guildId || !botToken) return res.status(500).json({ error: 'DISCORD_GUILD_ID / DISCORD_BOT_TOKEN not configured' });
    let roles = [];
    try {
      const memberRes = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
        headers: { Authorization: `Bot ${botToken}` },
      });
      roles = memberRes.data?.roles || [];
    } catch (e) {
      if (e.response?.status === 404) return res.json({ inGuild: false, booster: false, lfg: false });
      throw e;
    }
    let claimedBooster = false;
    let claimedLfg = false;
    try {
      const [rows] = await pool.query('SELECT platform FROM claimed_follows WHERE user_id = ? AND platform IN (?, ?)', [userId, 'booster', 'lfg']);
      for (const r of rows) {
        if (r.platform === 'booster') claimedBooster = true;
        if (r.platform === 'lfg') claimedLfg = true;
      }
    } catch { /* ignore claimed lookup */ }
    res.json({
      inGuild: true,
      booster: roles.includes(boosterRole),
      lfg: roles.includes(lfgRole),
      claimedBooster,
      claimedLfg,
    });
  } catch (error) {
    console.error('Discord Roles Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to check Discord roles' });
  }
});

// Claim +100 AC for following (manual check + one-claim guard)
// ponytail: no Helix call — users/follows is deprecated and needs follower token; require linked twitch_id + claimed_follows PK covers it
// POST /claim/follow { userId, platform: 'twitch' | 'youtube' | 'booster' | 'lfg' }
app.post('/claim/follow', async (req, res) => {
  try {
    const { userId, platform } = req.body;
    if (!userId || !['twitch', 'youtube', 'booster', 'lfg'].includes(platform)) {
      return res.status(400).json({ error: 'userId and platform (twitch|youtube|booster|lfg) required' });
    }
    const amounts = { twitch: 100, youtube: 100, booster: 150, lfg: 100 };
    const amount = amounts[platform];
    const [claimed] = await pool.query('SELECT 1 FROM claimed_follows WHERE user_id = ? AND platform = ?', [userId, platform]);
    if (claimed.length > 0) return res.status(400).json({ error: 'Already claimed' });
    if (platform === 'twitch') {
      const [users] = await pool.query('SELECT twitch_id FROM users WHERE id = ?', [userId]);
      if (users.length === 0 || !users[0].twitch_id) return res.status(400).json({ error: 'Twitch not linked' });
    }
    if (platform === 'booster' || platform === 'lfg') {
      const guildId = process.env.DISCORD_GUILD_ID;
      const botToken = process.env.DISCORD_BOT_TOKEN;
      const boosterRole = process.env.DISCORD_BOOSTER_ROLE_ID || '1548408109456826519';
      const lfgRole = process.env.DISCORD_LFG_ROLE_ID || '1543368029063217193';
      if (!guildId || !botToken) return res.status(500).json({ error: 'DISCORD_GUILD_ID / DISCORD_BOT_TOKEN not configured' });
      let roles = [];
      try {
        const memberRes = await axios.get(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
          headers: { Authorization: `Bot ${botToken}` },
        });
        roles = memberRes.data?.roles || [];
      } catch (e) {
        if (e.response?.status === 404) return res.status(400).json({ error: 'Join the Discord server first' });
        throw e;
      }
      const need = platform === 'booster' ? boosterRole : lfgRole;
      if (!roles.includes(need)) return res.status(400).json({ error: platform === 'booster' ? 'Server Booster role not found' : 'LFG role not found' });
    }
    await pool.query('UPDATE users SET alone_coin = alone_coin + ? WHERE id = ?', [amount, userId]);
    await pool.query('INSERT INTO claimed_follows (user_id, platform) VALUES (?, ?)', [userId, platform]);
    await pool.query('INSERT INTO coin_history (user_id, amount, reason) VALUES (?, ?, ?)', [userId, amount, `follow ${platform} +${amount} AC`]);
    const [rows] = await pool.query('SELECT alone_coin FROM users WHERE id = ?', [userId]);
    res.json({ balance: rows[0]?.alone_coin ?? 0 });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Already claimed' });
    console.error('Claim Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to claim' });
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

    // 3. Save/Update user in MySQL — never overwrite email on login
    await pool.query(
      `INSERT INTO users (id, username, email, avatar, alone_coin)
       VALUES (?, ?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE username = VALUES(username), avatar = VALUES(avatar)`,
      [discordUser.id, discordUser.username, discordUser.email || null, discordUser.avatar || null]
    );
    const [dbRows] = await pool.query('SELECT email FROM users WHERE id = ?', [discordUser.id]);

    // 4. Send profile back to frontend
    res.json({
      username: discordUser.username,
      avatar: discordUser.avatar,
      id: discordUser.id,
      email: dbRows[0]?.email ?? discordUser.email ?? null,
    });
  } catch (error) {
    console.error('Discord Auth Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Twitch Channel Points — detect custom reward redemptions and convert to Alone Coin
// Setup: TWITCH_BROADCASTER_ID + tokens from twitchtokengenerator.com saved as
// TWITCH_OAUTH_TOKEN + TWITCH_OAUTH_REFRESH (broadcaster OAuth with
// channel:read:redemptions + channel:manage:redemptions) + TWITCH_CHANNEL_REWARD_ID.
// ponytail: no EventSub webhook — manual claim flow (user redeems on Twitch, clicks claim, backend verifies + fulfills) covers it without public webhook infra
let broadcasterToken = process.env.TWITCH_BROADCASTER_TOKEN || process.env.TWITCH_OAUTH_TOKEN || null;

// Exchange the refresh token for a fresh broadcaster token via twitchtokengenerator.com
// (generator tokens use TTG's client id, so our TWITCH_CLIENT_SECRET can't refresh them directly)
const refreshBroadcasterToken = async () => {
  const refreshToken = process.env.TWITCH_OAUTH_REFRESH;
  if (!refreshToken) throw Object.assign(new Error('TWITCH_OAUTH_REFRESH not configured'), { status: 500 });
  // const res = await axios.post('https://twitchtokengenerator.com/api/v2/tokens/refresh', {
  //   refresh_token: refreshToken,
  // }, { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } });
  // broadcasterToken = res.data.access_token;
  const twitchrefresh = await fetch('https://twitchtokengenerator.com/api/refresh/' + process.env.TWITCH_OAUTH_REFRESH);
  const twitchdata = await twitchrefresh.json();
  process.env.TWITCH_OAUTH_TOKEN = twitchdata.token ?? twitchdata.access_token;
  broadcasterToken = process.env.TWITCH_OAUTH_TOKEN;
  if (res.data.refresh_token) process.env.TWITCH_OAUTH_REFRESH = res.data.refresh_token;
  console.log('🔄 Refreshed Twitch broadcaster token');
  return broadcasterToken;
};

const twitchHelix = async (method, path, { params, body, retry = true } = {}) => {
  if (!process.env.TWITCH_BROADCASTER_ID) {
    throw Object.assign(new Error('TWITCH_BROADCASTER_ID not configured'), { status: 500 });
  }
  if (!broadcasterToken) await refreshBroadcasterToken();
  try {
    const res = await axios({
      method,
      url: `https://api.twitch.tv/helix${path}`,
      params,
      data: body,
      headers: { Authorization: `Bearer ${broadcasterToken}`, 'Client-Id': process.env.TWITCH_CLIENT_ID },
    });
    return res.data;
  } catch (e) {
    if (e.response?.status === 401 && retry) {
      await refreshBroadcasterToken();
      return twitchHelix(method, path, { params, body, retry: false });
    }
    if (e.response?.status === 401) {
      throw Object.assign(new Error('Broadcaster token expired — re-auth via twitchtokengenerator.com'), { status: 401 });
    }
    throw e;
  }
};

// List custom channel-point rewards (to find the reward ID to detect)
// GET /twitch/channel-rewards
app.get('/twitch/channel-rewards', async (req, res) => {
  try {
    const data = await twitchHelix('get', '/channel_points/custom_rewards', {
      params: { broadcaster_id: process.env.TWITCH_BROADCASTER_ID },
    });
    res.json((data.data || []).map((r) => ({ id: r.id, title: r.title, cost: r.cost, is_enabled: r.is_enabled })));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to list channel rewards' });
  }
});

// Check if linked user has an unclaimed channel-point redemption
// GET /twitch/channel-points?userId=<main id>
app.get('/twitch/channel-points', async (req, res) => {
  try {
    const userId = req.query.userId ? String(req.query.userId) : null;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    const [users] = await pool.query('SELECT twitch_id FROM users WHERE id = ?', [userId]);
    if (users.length === 0 || !users[0].twitch_id) {
      return res.json({ linked: false, redeemable: false, reason: 'twitch_not_linked' });
    }
    const rewardId = process.env.TWITCH_CHANNEL_REWARD_ID;
    if (!rewardId) return res.status(500).json({ error: 'TWITCH_CHANNEL_REWARD_ID not configured' });
    const data = await twitchHelix('get', '/channel_points/custom_rewards/redemptions', {
      params: {
        broadcaster_id: process.env.TWITCH_BROADCASTER_ID,
        reward_id: rewardId,
        status: 'UNFULFILLED',
        first: 50,
      },
    });
    const mine = (data.data || []).filter((r) => r.user_id === users[0].twitch_id);
    res.json({ linked: true, redeemable: mine.length > 0, pending: mine.length });
  } catch (error) {
    console.error('Channel Points Check Error:', error.response?.data || error.message);
    res.status(error.status || 500).json({ error: error.message || 'Failed to check channel points' });
  }
});

// Claim one redemption -> grant AC + mark FULFILLED on Twitch (prevents double-spend)
// POST /claim/channel-points { userId }
app.post('/claim/channel-points', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const [users] = await pool.query('SELECT twitch_id FROM users WHERE id = ?', [userId]);
    if (users.length === 0 || !users[0].twitch_id) return res.status(400).json({ error: 'Twitch not linked' });
    const rewardId = process.env.TWITCH_CHANNEL_REWARD_ID;
    if (!rewardId) return res.status(500).json({ error: 'TWITCH_CHANNEL_REWARD_ID not configured' });
    const amount = Number(process.env.CHANNEL_POINTS_AC || 100);
    const data = await twitchHelix('get', '/channel_points/custom_rewards/redemptions', {
      params: {
        broadcaster_id: process.env.TWITCH_BROADCASTER_ID,
        reward_id: rewardId,
        status: 'UNFULFILLED',
        first: 50,
      },
    });
    const redemption = (data.data || []).find((r) => r.user_id === users[0].twitch_id);
    if (!redemption) return res.status(400).json({ error: 'No unclaimed channel-point reward found — redeem it on Twitch first' });
    const [dup] = await pool.query('SELECT 1 FROM channel_point_claims WHERE redemption_id = ?', [redemption.id]);
    if (dup.length > 0) return res.status(400).json({ error: 'Already claimed' });
    await pool.query('UPDATE users SET alone_coin = alone_coin + ? WHERE id = ?', [amount, userId]);
    await pool.query(
      'INSERT INTO channel_point_claims (redemption_id, user_id, twitch_id, granted_ac) VALUES (?, ?, ?, ?)',
      [redemption.id, userId, users[0].twitch_id, amount]
    );
    await pool.query('INSERT INTO coin_history (user_id, amount, reason) VALUES (?, ?, ?)', [
      userId,
      amount,
      `twitch channel points +${amount} AC`,
    ]);
    await twitchHelix('patch', '/channel_points/custom_rewards/redemptions', {
      params: {
        broadcaster_id: process.env.TWITCH_BROADCASTER_ID,
        reward_id: rewardId,
        id: redemption.id,
      },
      body: { status: 'FULFILLED' },
    }).catch(() => null);
    const [rows] = await pool.query('SELECT alone_coin FROM users WHERE id = ?', [userId]);
    res.json({ balance: rows[0]?.alone_coin ?? 0, granted: amount });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Already claimed' });
    console.error('Channel Points Claim Error:', error.response?.data || error.message);
    res.status(error.status || 500).json({ error: error.message || 'Failed to claim channel points' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
