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
// Keep raw body for EventSub HMAC verification (Twitch signs the exact bytes)
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));

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

// Startup migration — add missing columns for DBs created before they existed
// (runs once at boot so admin PUT/POST and GET /rewards never 500 on first use)
(async () => {
  const backfill = async (sql) => {
    try { await pool.query(sql); } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') console.error('Migration warning:', e.sqlMessage || e.message);
    }
  };
  await backfill("ALTER TABLE rewards ADD COLUMN contact_type VARCHAR(50) NULL");
  await backfill("ALTER TABLE rewards ADD COLUMN claimable TINYINT(1) NOT NULL DEFAULT 1");
  await backfill("ALTER TABLE rewards ADD COLUMN one_per_user TINYINT(1) NOT NULL DEFAULT 0");
  await backfill("ALTER TABLE rewards ADD COLUMN sort_order INT NOT NULL DEFAULT 0");
  await backfill("ALTER TABLE users ADD COLUMN warframe_ign VARCHAR(255) NULL");
  await backfill("ALTER TABLE users ADD COLUMN disabled TINYINT(1) NOT NULL DEFAULT 0");
})();

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

// Get all rewards from Database (admin sees all via same list; frontend filters disabled)
app.get('/rewards', async (req, res) => {
  try {
    // Backfill for DBs created before the enabled / contact_type / claimable / one_per_user / sort_order columns existed
    await pool.query('ALTER TABLE rewards ADD COLUMN IF NOT EXISTS enabled TINYINT(1) NOT NULL DEFAULT 1').catch(() => {});
    await pool.query('ALTER TABLE rewards ADD COLUMN IF NOT EXISTS claimable TINYINT(1) NOT NULL DEFAULT 1').catch(() => {});
    await pool.query('ALTER TABLE rewards ADD COLUMN IF NOT EXISTS one_per_user TINYINT(1) NOT NULL DEFAULT 0').catch(() => {});
    await pool.query('ALTER TABLE rewards ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0').catch(() => {});
    await pool.query("ALTER TABLE rewards ADD COLUMN IF NOT EXISTS contact_type VARCHAR(50) NULL").catch(() => {});
    // Fallback for MySQL (no IF NOT EXISTS support) — ignore duplicate-column error
    await pool.query("ALTER TABLE rewards ADD COLUMN contact_type VARCHAR(50) NULL").catch((e) => {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    });
    await pool.query("ALTER TABLE rewards ADD COLUMN claimable TINYINT(1) NOT NULL DEFAULT 1").catch((e) => {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    });
    await pool.query("ALTER TABLE rewards ADD COLUMN one_per_user TINYINT(1) NOT NULL DEFAULT 0").catch((e) => {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    });
    await pool.query("ALTER TABLE rewards ADD COLUMN sort_order INT NOT NULL DEFAULT 0").catch((e) => {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    });
    const [rows] = await pool.query('SELECT *, (enabled <> 0) AS enabled, (claimable <> 0) AS claimable, (one_per_user <> 0) AS one_per_user FROM rewards ORDER BY sort_order ASC, id ASC');
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

// User redemption endpoint
app.post('/redeem', async (req, res) => {
  try {
    const { userId, rewardId } = req.body;
    if (!userId || !rewardId) return res.status(400).json({ error: 'userId and rewardId required' });
    const rid = Number(rewardId);
    if (!Number.isInteger(rid)) return res.status(400).json({ error: 'Invalid reward ID' });

    const [reward] = await pool.query('SELECT * FROM rewards WHERE id = ?', [rid]);
    if (reward.length === 0) return res.status(404).json({ error: 'Reward not found' });
    const r = reward[0];

    if (r.enabled === 0) return res.status(400).json({ error: 'Reward is currently disabled' });
    if (r.claimable === 0) return res.status(400).json({ error: 'Reward is not claimable' });
    if (Number(r.stock) <= 0) return res.status(400).json({ error: 'Reward is out of stock' });
    if (r.one_per_user === 1 || r.one_per_user === true) {
      const [dup] = await pool.query('SELECT 1 FROM redemption_history WHERE user_id = ? AND reward_id = ? LIMIT 1', [userId, rid]);
      if (dup.length > 0) return res.status(400).json({ error: 'Already claimed this reward (one per user)' });
    }

    const [user] = await pool.query('SELECT alone_coin, disabled FROM users WHERE id = ?', [userId]);
    if (user.length === 0) return res.status(404).json({ error: 'User not found' });
    if (user[0].disabled) return res.status(403).json({ error: 'Your account is currently disabled' });
    if (user[0].alone_coin < r.cost) return res.status(400).json({ error: 'Insufficient Alone Coin' });

    await pool.query('UPDATE users SET alone_coin = alone_coin - ? WHERE id = ?', [r.cost, userId]);
    const [result] = await pool.query(
      'INSERT INTO redemption_history (user_id, reward_id, status) VALUES (?, ?, ?)',
      [userId, rid, 'processing']
    );
    await pool.query('UPDATE rewards SET stock = stock - 1 WHERE id = ? AND stock > 0', [rid]);
    await pool.query('INSERT INTO coin_history (user_id, amount, reason) VALUES (?, ?, ?)', [
      userId, -r.cost, `redeem: ${r.title}`
    ]);

    res.json({ success: true, redemptionId: result.insertId, balance: user[0].alone_coin - r.cost });
  } catch (error) {
    console.error('Redemption Error:', error);
    res.status(500).json({ error: 'Failed to redeem reward' });
  }
});

// List all users
app.get('/admin/users', checkAdminAuth, async (req, res) => {
  try {
    await pool.query("ALTER TABLE users ADD COLUMN disabled TINYINT(1) NOT NULL DEFAULT 0").catch((e) => {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    });
    const [rows] = await pool.query(
      'SELECT id, username, email, avatar, alone_coin, (disabled <> 0) AS disabled, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Enable/disable user
app.put('/admin/users/:id/disabled', checkAdminAuth, async (req, res) => {
  try {
    await pool.query("ALTER TABLE users ADD COLUMN disabled TINYINT(1) NOT NULL DEFAULT 0").catch((e) => {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    });
    const id = decodeURIComponent(req.params.id);
    const { disabled } = req.body;
    const flag = disabled === true || disabled === 1 || disabled === '1' ? 1 : 0;
    await pool.query('UPDATE users SET disabled = ? WHERE id = ?', [flag, id]);
    const [rows] = await pool.query('SELECT id, username, email, avatar, alone_coin, (disabled <> 0) AS disabled, created_at FROM users WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Public leaderboard - top 10 users by coin balance
app.get('/leaderboard', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, username, alone_coin FROM users WHERE alone_coin > 0 ORDER BY alone_coin DESC LIMIT 10'
    );
    res.json(rows);
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
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
    const { title, description, cost, accent, icon, stock, enabled, claimable, one_per_user, contact_type } = req.body;
    if (!title || cost === undefined) return res.status(400).json({ error: 'title and cost required' });
    await pool.query("ALTER TABLE rewards ADD COLUMN sort_order INT NOT NULL DEFAULT 0").catch((e) => {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    });
    const [maxRow] = await pool.query('SELECT COALESCE(MAX(sort_order), -1) + 1 AS nextOrder FROM rewards');
    const [result] = await pool.query(
      'INSERT INTO rewards (title, description, cost, accent, icon, stock, enabled, claimable, one_per_user, sort_order, contact_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [title, description || '', Number(cost) || 0, accent || 'peach', icon || '✦', Number(stock) || 0, enabled === false || enabled === 0 || enabled === '0' ? 0 : 1, claimable === false || claimable === 0 || claimable === '0' ? 0 : 1, one_per_user === false || one_per_user === 0 || one_per_user === '0' ? 0 : 1, Number(maxRow[0]?.nextOrder ?? 0), contact_type || null]
    );
    const [rows] = await pool.query('SELECT *, (enabled <> 0) AS enabled, (claimable <> 0) AS claimable, (one_per_user <> 0) AS one_per_user FROM rewards WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Failed to create reward' });
  }
});

// Reorder rewards — body: { order: number[] } (ids top-to-bottom)
// NOTE: must be defined BEFORE /admin/rewards/:id so 'reorder' is not treated as an id
app.put('/admin/rewards/reorder', checkAdminAuth, async (req, res) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of ids' });

    // Ensure column exists (safe backfill)
    await pool.query("ALTER TABLE rewards ADD COLUMN sort_order INT NOT NULL DEFAULT 0").catch((e) => {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    });

    // Use a transaction to ensure all orders are updated together
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (let i = 0; i < order.length; i++) {
        const id = Number(order[i]);
        if (!Number.isInteger(id)) continue;
        await conn.query('UPDATE rewards SET sort_order = ? WHERE id = ?', [i, id]);
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
    const [rows] = await pool.query('SELECT *, (enabled <> 0) AS enabled, (claimable <> 0) AS claimable, (one_per_user <> 0) AS one_per_user FROM rewards ORDER BY sort_order ASC, id ASC');
    res.json(rows);
  } catch (error) {
    console.error('Reorder Error:', error);
    res.status(500).json({ error: 'Failed to reorder rewards' });
  }
});

// Update reward
app.put('/admin/rewards/:id', checkAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    // Guard: if id is not numeric, this route was hit by mistake (e.g. /reorder defined after)
    if (!/^\d+$/.test(String(id))) return res.status(404).json({ error: 'Reward not found' });
    const { title, description, cost, accent, icon, stock, enabled, claimable, one_per_user, contact_type } = req.body;
    await pool.query(
      'UPDATE rewards SET title = ?, description = ?, cost = ?, accent = ?, icon = ?, stock = ?, enabled = ?, claimable = ?, one_per_user = ?, contact_type = ? WHERE id = ?',
      [title, description || '', Number(cost) || 0, accent || 'peach', icon || '✦', Number(stock) || 0, enabled === false || enabled === 0 || enabled === '0' ? 0 : 1, claimable === false || claimable === 0 || claimable === '0' ? 0 : 1, one_per_user === false || one_per_user === 0 || one_per_user === '0' ? 0 : 1, contact_type || null, id]
    );
    const [rows] = await pool.query('SELECT *, (enabled <> 0) AS enabled, (claimable <> 0) AS claimable, (one_per_user <> 0) AS one_per_user FROM rewards WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Reward not found' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Failed to update reward' });
  }
});

// Delete reward (also reorder endpoint lives above to avoid :id='reorder' clash)
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

// List redemptions with status for user progress
app.get('/users/:userId/redemptions', async (req, res) => {
  try {
    const { userId } = req.params;
    const [rows] = await pool.query(
      `SELECT h.id, h.reward_id, h.redeemed_at, h.status, r.title AS reward_title, r.cost, r.contact_type
       FROM redemption_history h
       LEFT JOIN rewards r ON r.id = h.reward_id
       WHERE h.user_id = ? ORDER BY h.redeemed_at DESC LIMIT 100`,
      [userId]
    );
    res.json(rows);
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Failed to fetch redemptions' });
  }
});

// Admin: update redemption status
app.put('/admin/redemptions/:id/status', checkAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status required' });
    await pool.query('UPDATE redemption_history SET status = ? WHERE id = ?', [status, id]);
    res.json({ ok: true });
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Redemption history
app.get('/admin/redemptions', checkAdminAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT h.id, h.reward_id, h.redeemed_at, u.username, u.id AS user_id, u.email, u.epic_username, u.warframe_ign, r.title AS reward_title, r.cost AS reward_cost, r.contact_type
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

// Rollback a coin grant: reverse balance + compensating audit entry (original kept)
// POST /admin/coin-history/:id/rollback
app.post('/admin/coin-history/:id/rollback', checkAdminAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    const [orig] = await pool.query('SELECT user_id, amount, reason FROM coin_history WHERE id = ?', [id]);
    if (orig.length === 0) return res.status(404).json({ error: 'Entry not found' });
    if ((orig[0].reason || '').startsWith('rollback ')) return res.status(400).json({ error: 'Cannot rollback a rollback entry' });
    const [dup] = await pool.query('SELECT 1 FROM coin_history WHERE reason LIKE ?', [`rollback coin #${id}%`]);
    if (dup.length > 0) return res.status(409).json({ error: 'Already rolled back' });
    await pool.query('UPDATE users SET alone_coin = alone_coin - ? WHERE id = ?', [orig[0].amount, orig[0].user_id]);
    await pool.query('INSERT INTO coin_history (user_id, amount, reason) VALUES (?, ?, ?)', [
      orig[0].user_id,
      -orig[0].amount,
      `rollback coin #${id}: ${orig[0].reason || ''}`.slice(0, 255),
    ]);
    // Free re-claim: follow/sub claims leave a claimed_follows lock — without this
    // the user can never claim that month again after a rollback
    let freedClaim = null;
    const claimMatch = (orig[0].reason || '').match(/^follow (\S+)/);
    if (claimMatch) {
      freedClaim = claimMatch[1];
      await pool.query('DELETE FROM claimed_follows WHERE user_id = ? AND platform = ?', [orig[0].user_id, freedClaim]);
    }
    const [rows] = await pool.query('SELECT alone_coin FROM users WHERE id = ?', [orig[0].user_id]);
    res.json({ balance: rows[0]?.alone_coin ?? 0, reverted: -orig[0].amount, freedClaim });
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Failed to rollback' });
  }
});

// List Twitch sub monthly claims (admin) — who claimed which month + granted AC
// GET /admin/sub-claims
app.get('/admin/sub-claims', checkAdminAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.user_id, c.platform, c.claimed_at, u.username, u.twitch_username,
              (SELECT h.amount FROM coin_history h
               WHERE h.user_id = c.user_id AND h.reason LIKE CONCAT('follow ', c.platform, '%')
               ORDER BY h.created_at DESC LIMIT 1) AS granted_ac
       FROM claimed_follows c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.platform LIKE 'twitchsub%'
       ORDER BY c.claimed_at DESC LIMIT 100`
    );
    res.json(rows);
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Failed to fetch sub claims' });
  }
});

// Reset a Twitch sub monthly claim so the user can re-claim that month.
// Reverses the coin grant (audit entry kept) + deletes the claimed_follows lock
// (monthly `twitchsub:YYYY-MM` and legacy plain `twitchsub` claimed in that month).
// POST /admin/sub-claims/reset { userId, monthKey? } — monthKey YYYY-MM, default current month
app.post('/admin/sub-claims/reset', checkAdminAuth, async (req, res) => {
  try {
    const userId = req.body?.userId ? String(req.body.userId) : null;
    const monthKey = req.body?.monthKey ? String(req.body.monthKey) : new Date().toISOString().slice(0, 7);
    if (!userId) return res.status(400).json({ error: 'userId required' });
    if (!/^\d{4}-\d{2}$/.test(monthKey)) return res.status(400).json({ error: 'monthKey must be YYYY-MM' });
    const monthPlatform = `twitchsub:${monthKey}`;
    // Find this month's coin grant (monthly row, or legacy plain row created that month)
    const [grants] = await pool.query(
      `SELECT id, amount, reason FROM coin_history
       WHERE user_id = ? AND (reason LIKE ? OR (reason LIKE 'follow twitchsub %' AND DATE_FORMAT(created_at, '%Y-%m') = ?))
       ORDER BY created_at DESC LIMIT 1`,
      [userId, `follow ${monthPlatform}%`, monthKey]
    );
    let reverted = 0;
    if (grants.length > 0) {
      const g = grants[0];
      const [dup] = await pool.query('SELECT 1 FROM coin_history WHERE reason LIKE ?', [`rollback sub ${userId} ${monthPlatform}%`]);
      if (dup.length === 0) {
        await pool.query('UPDATE users SET alone_coin = alone_coin - ? WHERE id = ?', [g.amount, userId]);
        await pool.query('INSERT INTO coin_history (user_id, amount, reason) VALUES (?, ?, ?)', [
          userId,
          -g.amount,
          `rollback sub ${userId} ${monthPlatform} (coin #${g.id})`.slice(0, 255),
        ]);
        reverted = -Number(g.amount);
      }
    }
    await pool.query('DELETE FROM claimed_follows WHERE user_id = ? AND platform = ?', [userId, monthPlatform]);
    await pool.query(
      "DELETE FROM claimed_follows WHERE user_id = ? AND platform = 'twitchsub' AND DATE_FORMAT(claimed_at, '%Y-%m') = ?",
      [userId, monthKey]
    );
    const [rows] = await pool.query('SELECT alone_coin FROM users WHERE id = ?', [userId]);
    res.json({ ok: true, monthKey, reverted, balance: rows[0]?.alone_coin ?? 0 });
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Failed to reset sub claim' });
  }
});

// Revoke a Twitch sub monthly claim WITHOUT re-claim: reverses the coin grant
// (audit entry kept) but KEEPS the claimed_follows lock so the user cannot
// re-claim that month. Use when coins were granted by mistake / abuse.
// POST /admin/sub-claims/revoke { userId, monthKey? } — monthKey YYYY-MM, default current month
app.post('/admin/sub-claims/revoke', checkAdminAuth, async (req, res) => {
  try {
    const userId = req.body?.userId ? String(req.body.userId) : null;
    const monthKey = req.body?.monthKey ? String(req.body.monthKey) : new Date().toISOString().slice(0, 7);
    if (!userId) return res.status(400).json({ error: 'userId required' });
    if (!/^\d{4}-\d{2}$/.test(monthKey)) return res.status(400).json({ error: 'monthKey must be YYYY-MM' });
    const monthPlatform = `twitchsub:${monthKey}`;
    const [grants] = await pool.query(
      `SELECT id, amount, reason FROM coin_history
       WHERE user_id = ? AND (reason LIKE ? OR (reason LIKE 'follow twitchsub %' AND DATE_FORMAT(created_at, '%Y-%m') = ?))
       ORDER BY created_at DESC LIMIT 1`,
      [userId, `follow ${monthPlatform}%`, monthKey]
    );
    let reverted = 0;
    if (grants.length > 0) {
      const g = grants[0];
      const [dup] = await pool.query('SELECT 1 FROM coin_history WHERE reason LIKE ?', [`revoke sub ${userId} ${monthPlatform}%`]);
      if (dup.length === 0) {
        await pool.query('UPDATE users SET alone_coin = alone_coin - ? WHERE id = ?', [g.amount, userId]);
        await pool.query('INSERT INTO coin_history (user_id, amount, reason) VALUES (?, ?, ?)', [
          userId,
          -g.amount,
          `revoke sub ${userId} ${monthPlatform} (coin #${g.id})`.slice(0, 255),
        ]);
        reverted = -Number(g.amount);
      }
    }
    // ponytail: lock kept on purpose — revoke != reset, no re-claim allowed
    const [rows] = await pool.query('SELECT alone_coin FROM users WHERE id = ?', [userId]);
    res.json({ ok: true, monthKey, reverted, balance: rows[0]?.alone_coin ?? 0 });
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Failed to revoke sub claim' });
  }
});

// Seed tenure for Twitch sub monthly claims (admin).
// DEPRECATED: Tenure stacking removed.
// POST /admin/sub-claims/seed { userId, months }
app.post('/admin/sub-claims/seed', checkAdminAuth, async (req, res) => {
  res.status(400).json({ error: 'Tenure seeding is deprecated. Rewards are now flat 200 AC monthly.' });
});

// Rollback a redemption: refund cost, restore stock, delete row + audit entry
// POST /admin/redemptions/:id/rollback
app.post('/admin/redemptions/:id/rollback', checkAdminAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    const [rows] = await pool.query(
      `SELECT h.user_id, h.reward_id, r.cost, r.title
       FROM redemption_history h LEFT JOIN rewards r ON r.id = h.reward_id WHERE h.id = ?`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Redemption not found' });
    const [dup] = await pool.query('SELECT 1 FROM coin_history WHERE reason LIKE ?', [`rollback redeem #${id}%`]);
    if (dup.length > 0) return res.status(409).json({ error: 'Already rolled back' });
    const cost = Number(rows[0].cost || 0);
    if (cost > 0) {
      await pool.query('UPDATE users SET alone_coin = alone_coin + ? WHERE id = ?', [cost, rows[0].user_id]);
      await pool.query('INSERT INTO coin_history (user_id, amount, reason) VALUES (?, ?, ?)', [
        rows[0].user_id,
        cost,
        `rollback redeem #${id} ${rows[0].title || ''}`.slice(0, 255),
      ]);
    }
    if (rows[0].reward_id) await pool.query('UPDATE rewards SET stock = stock + 1 WHERE id = ?', [rows[0].reward_id]);
    await pool.query('DELETE FROM redemption_history WHERE id = ?', [id]);
    const [bal] = await pool.query('SELECT alone_coin FROM users WHERE id = ?', [rows[0].user_id]);
    res.json({ balance: bal[0]?.alone_coin ?? 0, refunded: cost });
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Failed to rollback redemption' });
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

// User coin history (earn/spend ledger)
// GET /users/:id/coin-history
app.get('/users/:id/coin-history', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      'SELECT id, amount, reason, created_at FROM coin_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 100',
      [id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Failed to fetch coin history' });
  }
});

// User redemption history (rewards redeemed)
// GET /users/:id/redemptions
app.get('/users/:id/redemptions', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT h.id, h.redeemed_at, r.title AS reward_title, r.cost
       FROM redemption_history h
       LEFT JOIN rewards r ON r.id = h.reward_id
       WHERE h.user_id = ? ORDER BY h.redeemed_at DESC LIMIT 100`,
      [id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Failed to fetch redemptions' });
  }
});

// Get user profile (email + epic username + warframe IGN from DB)
// GET /users/:id
app.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("ALTER TABLE users ADD COLUMN warframe_ign VARCHAR(255) NULL").catch((e) => {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    });
    const [rows] = await pool.query(
      'SELECT id, username, email, avatar, alone_coin, epic_username, warframe_ign, twitch_id, twitch_username FROM users WHERE id = ?',
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile (email + epic username + warframe IGN saved to DB)
// PUT /users/:id { email, epic_username, warframe_ign }
app.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { email, epic_username, warframe_ign } = req.body;
    await pool.query("ALTER TABLE users ADD COLUMN warframe_ign VARCHAR(255) NULL").catch((e) => {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    });
    await pool.query('UPDATE users SET email = ?, epic_username = ?, warframe_ign = ? WHERE id = ?', [
      email || null,
      epic_username || null,
      warframe_ign || null,
      id,
    ]);
    const [rows] = await pool.query(
      'SELECT id, username, email, avatar, alone_coin, epic_username, warframe_ign, twitch_id, twitch_username FROM users WHERE id = ?',
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

// Check if linked user is subscribed to boyalone99 on Twitch (Helix subscriptions)
// Needs broadcaster token with channel:read:subscriptions scope
// GET /follow/twitchsub?userId=<main id>
app.get('/follow/twitchsub', async (req, res) => {
  try {
    const userId = req.query.userId ? String(req.query.userId) : null;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    const [users] = await pool.query('SELECT twitch_id FROM users WHERE id = ?', [userId]);
    if (users.length === 0 || !users[0].twitch_id) {
      return res.json({ subscribed: false, reason: 'twitch_not_linked', subscribeUrl: 'https://www.twitch.tv/subs/boyalone99' });
    }
    const monthKey = new Date().toISOString().slice(0, 7); // YYYY-MM
    const monthPlatform = `twitchsub:${monthKey}`;
    const [claimedRows] = await pool.query(
      'SELECT platform, claimed_at FROM claimed_follows WHERE user_id = ? AND (platform = ? OR platform = ?)',
      [userId, monthPlatform, 'twitchsub']
    );
    const claimedThisMonth = claimedRows.some((r) => {
      if (r.platform === monthPlatform) return true;
      if (r.platform === 'twitchsub' && r.claimed_at) {
        try {
          return new Date(r.claimed_at).toISOString().slice(0, 7) === monthKey;
        } catch { return false; }
      }
      return false;
    });
    const [monthCount] = await pool.query(
      "SELECT COUNT(*) AS n FROM claimed_follows WHERE user_id = ? AND platform LIKE 'twitchsub%'",
      [userId]
    );
    const monthsClaimed = Number(monthCount[0]?.n || 0);
    const baseAmount = Number(process.env.TWITCH_SUB_AC || 200);
    const twitchMonths = await getTwitchTenure(users[0].twitch_id);
    const effectiveNext = Math.max(monthsClaimed + 1, twitchMonths);
    const tenureAuto = twitchMonths > 0;
    try {
      const data = await twitchHelix('get', '/subscriptions', {
        params: { broadcaster_id: process.env.TWITCH_BROADCASTER_ID, user_id: users[0].twitch_id },
      });
      const sub = (data.data || [])[0] || null;
      res.json({ subscribed: !!sub, tier: sub?.tier || null, isGift: sub?.is_gift ?? null, claimed: claimedThisMonth, monthKey, monthsClaimed, baseAmount, twitchMonths: twitchMonths || null, tenureSource: twitchMonths > 0 ? 'twitch' : 'streak', tenureAuto, nextAmount: baseAmount * effectiveNext, effectiveTenure: effectiveNext, subscribeUrl: 'https://www.twitch.tv/subs/boyalone99' });
    } catch (e) {
      if (e.status === 403 || e.response?.status === 403) {
        return res.json({ subscribed: null, reason: 'missing_scope', claimed: claimedThisMonth, monthKey, monthsClaimed, baseAmount, twitchMonths: twitchMonths || null, tenureSource: twitchMonths > 0 ? 'twitch' : 'streak', tenureAuto, needsTenureInput: false, nextAmount: baseAmount * effectiveNext, effectiveTenure: effectiveNext, subscribeUrl: 'https://www.twitch.tv/subs/boyalone99' });
      }
      throw e;
    }
  } catch (error) {
    console.error('Twitch Sub Check Error:', error.response?.data || error.message);
    const upstream = error.response?.status;
    res.status(upstream || error.status || 500).json({ error: error.response?.data?.message || error.message || 'Failed to check Twitch subscription' });
  }
});

// Check YouTube sub — Verify if user is subscribed to boyalone99 using YouTube Data API v3
// GET /follow/youtube?userId=<main id>&accessToken=<google oauth token>
app.get('/follow/youtube', async (req, res) => {
  try {
    const channelUrl = process.env.YOUTUBE_CHANNEL_URL || (process.env.YOUTUBE_CHANNEL_ID ? `https://www.youtube.com/channel/${process.env.YOUTUBE_CHANNEL_ID}?sub_confirmation=1` : 'https://youtube.com/@BoyAlone99Gaming?sub_confirmation=1');
    const targetChannelId = process.env.YOUTUBE_CHANNEL_ID || null;
    const userId = req.query.userId ? String(req.query.userId) : null;
    const accessToken = req.query.accessToken ? String(req.query.accessToken) : null;
    let claimed = false;
    if (userId) {
      const [rows] = await pool.query('SELECT 1 FROM claimed_follows WHERE user_id = ? AND platform = ?', [userId, 'youtube']);
      claimed = rows.length > 0;
    }
    // If we have a user access token with youtube.readonly scope + target channel ID,
    // verify subscription via subscriptions.list?mine=true&forChannelId=...
    if (accessToken && targetChannelId) {
      try {
        const subRes = await axios.get('https://www.googleapis.com/youtube/v3/subscriptions', {
          params: { part: 'snippet', mine: 'true', forChannelId: targetChannelId },
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 8000,
        });
        const items = subRes.data?.items || [];
        const subscribed = items.length > 0;
        return res.json({ following: subscribed, subscribed, channelUrl, claimed });
      } catch (e) {
        // Token expired/invalid or quota issue — fall through to manual check
        console.error('YouTube Sub Check Error:', e.response?.data || e.message);
        return res.json({ following: null, reason: 'token_invalid', channelUrl, claimed });
      }
    }
    res.json({ following: null, reason: 'manual_check_required', channelUrl, claimed, needsToken: !accessToken, needsChannelId: !targetChannelId });
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
    if (!userId || !['twitch', 'youtube', 'booster', 'lfg', 'twitchsub'].includes(platform)) {
      return res.status(400).json({ error: 'userId and platform (twitch|youtube|booster|lfg|twitchsub) required' });
    }
    const amounts = { twitch: 100, youtube: 100, booster: 150, lfg: 100, twitchsub: Number(process.env.TWITCH_SUB_AC || 200) };
    // Twitch sub is re-claimable every calendar month while sub is active.
    // Helix /subscriptions exposes no tenure field — tenure comes from the
    // twitch_sub_tenure table (EventSub channel.subscription.message cumulative_months).
    // Payout = base x max(prior claim streak + 1, twitch tenure).
    const isSubMonth = platform === 'twitchsub';
    const claimPlatform = isSubMonth ? `twitchsub:${new Date().toISOString().slice(0, 7)}` : platform;
    let amount = amounts[platform];
    
    if (isSubMonth) {
      // No tenure stacking: simply grant base amount
    }
    const [claimed] = await pool.query('SELECT 1 FROM claimed_follows WHERE user_id = ? AND platform = ?', [userId, claimPlatform]);
    if (claimed.length > 0) return res.status(400).json({ error: isSubMonth ? 'Already claimed this month — come back next month' : 'Already claimed' });
    const [uCheck] = await pool.query('SELECT disabled FROM users WHERE id = ?', [userId]);
    if (uCheck.length === 0 || uCheck[0].disabled) return res.status(403).json({ error: 'Your account is currently disabled' });
    if (platform === 'twitch' || platform === 'twitchsub') {
      const [users] = await pool.query('SELECT twitch_id FROM users WHERE id = ?', [userId]);
      if (users.length === 0 || !users[0].twitch_id) return res.status(400).json({ error: 'Twitch not linked' });
      if (platform === 'twitchsub') {
        try {
          const data = await twitchHelix('get', '/subscriptions', {
            params: { broadcaster_id: process.env.TWITCH_BROADCASTER_ID, user_id: users[0].twitch_id },
          });
          if (!(data.data || []).length) return res.status(400).json({ error: 'No active Twitch subscription found — subscribe first' });
        } catch (e) {
          if (e.status === 403 || e.response?.status === 403) {
            return res.status(400).json({ error: 'Broadcaster token missing channel:read:subscriptions — re-auth with sub scope' });
          }
          throw e;
        }
      }
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
    if (platform === 'youtube') {
      // Strict: require Google access token with youtube.readonly scope.
      // Body: { userId, platform: 'youtube', accessToken }
      const accessToken = req.body?.accessToken ? String(req.body.accessToken) : null;
      const targetChannelId = process.env.YOUTUBE_CHANNEL_ID || null;
      if (!accessToken) return res.status(400).json({ error: 'กรุณาล็อกอินด้วย YouTube/Google ใหม่เพื่อยืนยันการติดตาม' });
      if (!targetChannelId) return res.status(500).json({ error: 'YOUTUBE_CHANNEL_ID not configured' });
      try {
        const subRes = await axios.get('https://www.googleapis.com/youtube/v3/subscriptions', {
          params: { part: 'snippet', mine: 'true', forChannelId: targetChannelId },
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 8000,
        });
        const subscribed = (subRes.data?.items || []).length > 0;
        if (!subscribed) return res.status(400).json({ error: 'YouTube subscription not found — subscribe first' });
      } catch (e) {
        console.error('YouTube Claim Check Error:', e.response?.data || e.message);
        return res.status(400).json({ error: 'Could not verify YouTube subscription — re-login with YouTube and try again' });
      }
    }
    await pool.query('UPDATE users SET alone_coin = alone_coin + ? WHERE id = ?', [amount, userId]);
    await pool.query('INSERT INTO claimed_follows (user_id, platform) VALUES (?, ?)', [userId, claimPlatform]);
    await pool.query('INSERT INTO coin_history (user_id, amount, reason) VALUES (?, ?, ?)', [userId, amount, `follow ${claimPlatform} +${amount} AC`]);
    if (isSubMonth) {
      // removed tenure save
    }
    const [rows] = await pool.query('SELECT alone_coin FROM users WHERE id = ?', [userId]);
    if (isSubMonth) {
      return res.json({ balance: rows[0]?.alone_coin ?? 0, granted: amount, monthsClaimed: 1, monthKey: claimPlatform.split(':')[1] });
    }
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
    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: process.env.REDIRECT_URI || 'https://neon-granita-d423fd.netlify.app/login/callback',
    }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

    const accessToken = tokenResponse.data.access_token;
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const discordUser = userResponse.data;
    const rawId = discordUser.id;
    const userId = rawId.startsWith('discord:') ? rawId : `discord:${rawId}`;

    // Support migration: if the user exists with the raw ID, we use that as the primary key
    // to avoid foreign key constraint failures during ID updates.
    const [existing] = await pool.query('SELECT id FROM users WHERE id = ?', [rawId]);
    const finalUserId = existing.length > 0 ? existing[0].id : userId;

    await pool.query(
      `INSERT INTO users (id, username, email, avatar, alone_coin)
       VALUES (?, ?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE username = VALUES(username), avatar = VALUES(avatar)`,
      [finalUserId, discordUser.username, discordUser.email || null, discordUser.avatar || null]
    );
    const [dbRows] = await pool.query('SELECT email FROM users WHERE id = ?', [finalUserId]);

    res.json({
      username: discordUser.username,
      avatar: discordUser.avatar,
      id: finalUserId,
      email: dbRows[0]?.email ?? discordUser.email ?? null,
    });
  } catch (error) {
    console.error('Discord Auth Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Google/YouTube Callback Handler
app.get('/auth/google/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).json({ error: 'Missing code' });

  try {
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: process.env.REDIRECT_URI || 'https://neon-granita-d423fd.netlify.app/login/callback',
    }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

    const accessToken = tokenResponse.data.access_token;
    const userResponse = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const googleUser = userResponse.data;
    const userId = `google:${googleUser.sub}`;

    await pool.query(
      `INSERT INTO users (id, username, email, avatar, alone_coin)
       VALUES (?, ?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE username = VALUES(username), avatar = VALUES(avatar)`,
      [userId, googleUser.name, googleUser.email || null, googleUser.picture || null]
    );
    const [dbRows] = await pool.query('SELECT email FROM users WHERE id = ?', [userId]);

    res.json({
      username: googleUser.name,
      avatar: googleUser.picture,
      id: userId,
      email: dbRows[0]?.email ?? googleUser.email ?? null,
      accessToken,
    });
  } catch (error) {
    console.error('Google Auth Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Twitch Channel Points — detect custom reward redemptions and convert to Alone Coin
// Setup: TWITCH_BROADCASTER_ID + tokens from twitchtokengenerator.com saved as
// TWITCH_OAUTH_TOKEN + TWITCH_OAUTH_REFRESH (broadcaster OAuth with
// channel:read:redemptions + channel:manage:redemptions) + TWITCH_CHANNEL_REWARD_ID.
// ponytail: no EventSub webhook — manual claim flow (user redeems on Twitch, clicks claim, backend verifies + fulfills) covers it without public webhook infra
let broadcasterToken =
  process.env.TWITCH_BROADCASTER_TOKEN?.startsWith('paste_') === true
    ? null
    : process.env.TWITCH_BROADCASTER_TOKEN || process.env.TWITCH_OAUTH_TOKEN || null;
if (broadcasterToken?.startsWith('paste_')) broadcasterToken = null;
// TTG tokens are issued under TTG's client ID — Helix requires that same ID in the header.
let ttgClientId =
  process.env.TWITCH_TTG_CLIENT_ID && !process.env.TWITCH_TTG_CLIENT_ID.startsWith('your_')
    ? process.env.TWITCH_TTG_CLIENT_ID
    : 'gp762nuuoqcoxypju8c569th9wz7q5';
// Client-Id that issued the current broadcasterToken — must match in Helix header.
let broadcasterClientId = ttgClientId;

// Exchange the refresh token for a fresh broadcaster token via twitchtokengenerator.com
// (generator tokens use TTG's client id, so our TWITCH_CLIENT_SECRET can't refresh them directly)
// ponytail: single-flight — concurrent calls share one refresh instead of storming TTG
let refreshing = null;
const refreshBroadcasterToken = () => {
  if (refreshing) return refreshing;
  refreshing = doRefresh().finally(() => { refreshing = null; });
  return refreshing;
};
const doRefresh = async () => {
  const refreshToken = process.env.TWITCH_OAUTH_REFRESH;
  if (!refreshToken || refreshToken.startsWith('paste_'))
    throw Object.assign(new Error('TWITCH_OAUTH_REFRESH not configured — paste it from twitchtokengenerator.com'), { status: 500 });
  try {
    const res = await axios.post(
      'https://twitchtokengenerator.com/api/v2/tokens/refresh',
      { refresh_token: refreshToken },
      { headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, timeout: 5000 }
    );
    if (!res.data?.access_token) throw new Error('Refresh returned no access_token: ' + JSON.stringify(res.data).slice(0, 200));
    broadcasterToken = res.data.access_token;
    process.env.TWITCH_OAUTH_TOKEN = res.data.access_token;
    if (res.data.refresh_token) process.env.TWITCH_OAUTH_REFRESH = res.data.refresh_token;
    if (res.data.client_id) ttgClientId = res.data.client_id;
    broadcasterClientId = ttgClientId;
    console.log('🔄 Refreshed Twitch broadcaster token');
    return broadcasterToken;
  } catch (e) {
    const msg = e.response?.data?.message || e.message;
    throw Object.assign(new Error('TTG refresh failed: ' + msg), { status: 502 });
  }
};

const twitchHelix = async (method, path, { params, body, retry = true } = {}) => {
  if (!process.env.TWITCH_BROADCASTER_ID || process.env.TWITCH_BROADCASTER_ID.startsWith('your_')) {
    throw Object.assign(new Error('TWITCH_BROADCASTER_ID not configured — set your numeric broadcaster user id'), { status: 500 });
  }
  if (!broadcasterToken) await refreshBroadcasterToken();
  try {
    const res = await axios({
      method,
      url: `https://api.twitch.tv/helix${path}`,
      params,
      data: body,
      timeout: 7000,
      headers: { Authorization: `Bearer ${broadcasterToken}`, 'Client-Id': broadcasterClientId },
    });
    return res.data;
  } catch (e) {
    if (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT' || e.response?.status === 408) {
      throw Object.assign(new Error('Twitch timed out after 7s — try again'), { status: 504 });
    }
    if (e.response?.status === 403) {
      throw Object.assign(
        new Error('Twitch rejected Client-Id: query with the client ID that created the reward, or check affiliate/partner status.'),
        { status: 403 }
      );
    }
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

// App access token (client_credentials) — EventSub webhook subscribe/list requires this,
// NOT the broadcaster user token. Cached until expiry.
let appToken = null;
let appTokenExp = 0;
const getTwitchAppToken = async () => {
  if (appToken && Date.now() < appTokenExp - 60000) return appToken;
  const cid = process.env.TWITCH_CLIENT_ID;
  const csec = process.env.TWITCH_CLIENT_SECRET;
  if (!cid || cid.startsWith('your_') || !csec || csec.startsWith('your_'))
    throw Object.assign(new Error('TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET not configured — needed for EventSub app token'), { status: 500 });
  const res = await axios.post('https://id.twitch.tv/oauth2/token', new URLSearchParams({
    client_id: cid,
    client_secret: csec,
    grant_type: 'client_credentials',
  }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 8000 });
  appToken = res.data.access_token;
  appTokenExp = Date.now() + (Number(res.data.expires_in || 3600) * 1000);
  return appToken;
};

const twitchHelixApp = async (method, path, { params, body } = {}) => {
  const token = await getTwitchAppToken();
  try {
    const res = await axios({
      method,
      url: `https://api.twitch.tv/helix${path}`,
      params,
      data: body,
      timeout: 7000,
      headers: { Authorization: `Bearer ${token}`, 'Client-Id': process.env.TWITCH_CLIENT_ID },
    });
    return res.data;
  } catch (e) {
    if (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT' || e.response?.status === 408) {
      throw Object.assign(new Error('Twitch timed out after 7s — try again'), { status: 504 });
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
    console.error('Channel Rewards Error:', error.response?.data || error.message);
    const upstream = error.response?.status;
    res.status(upstream === 408 ? 504 : upstream || error.status || 500).json({ error: error.response?.data?.message || error.message || 'Failed to list channel rewards' });
  }
});

// Create channel-point reward via API so it is owned by the same Client-Id —
// dashboard rewards always 403 on Helix query. Requires broadcaster token with
// channel:manage:redemptions (TTG generator or step 1 Authorize).
// POST /admin/twitch/channel-rewards { title, cost, prompt? }
app.post('/admin/twitch/channel-rewards', checkAdminAuth, async (req, res) => {
  try {
    const title = String(req.body?.title || '').trim().slice(0, 45);
    const cost = Number(req.body?.cost);
    const prompt = String(req.body?.prompt || 'Redeem for Alone Coin').slice(0, 200);
    if (!title) return res.status(400).json({ error: 'title required (max 45 chars)' });
    if (!Number.isInteger(cost) || cost < 1) return res.status(400).json({ error: 'cost must be an integer >= 1' });
    const data = await twitchHelix('post', '/channel_points/custom_rewards', {
      params: { broadcaster_id: process.env.TWITCH_BROADCASTER_ID },
      body: {
        title,
        cost,
        prompt,
        is_enabled: true,
        is_user_input_required: false,
        should_redemptions_skip_request_queue: false,
      },
    });
    const r = data.data?.[0];
    if (!r) return res.status(500).json({ error: 'Twitch returned no reward' });
    process.env.TWITCH_CHANNEL_REWARD_ID = r.id;
    res.status(201).json({ id: r.id, title: r.title, cost: r.cost, is_enabled: r.is_enabled });
  } catch (error) {
    console.error('Create Reward Error:', error.response?.data || error.message);
    const upstream = error.response?.status;
    res.status(upstream || error.status || 500).json({ error: error.response?.data?.message || error.message || 'Failed to create reward' });
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
    const upstream = error.response?.status;
    res.status(upstream === 408 ? 504 : upstream || error.status || 500).json({ error: error.response?.data?.message || error.message || 'Failed to check channel points' });
  }
});

// Claim one redemption -> grant AC + mark FULFILLED on Twitch (prevents double-spend)
// POST /claim/channel-points { userId }
app.post('/claim/channel-points', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const [users] = await pool.query('SELECT twitch_id, disabled FROM users WHERE id = ?', [userId]);
    if (users.length === 0) return res.status(404).json({ error: 'User not found' });
    if (users[0].disabled) return res.status(403).json({ error: 'Your account is currently disabled' });
    if (!users[0].twitch_id) return res.status(400).json({ error: 'Twitch not linked' });
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
    const upstream = error.response?.status;
    res.status(upstream === 408 ? 504 : upstream || error.status || 500).json({ error: error.response?.data?.message || error.message || 'Failed to claim channel points' });
  }
});

// Twitch sub tenure — Helix GET /subscriptions returns tier/is_gift only, no month
// count. The month count only arrives via EventSub channel.subscription.message
// (cumulative_months). We store it here so first claim pays 200 x real months.
const ensureTenureTable = () => pool.query(`CREATE TABLE IF NOT EXISTS twitch_sub_tenure (
  twitch_id VARCHAR(255) PRIMARY KEY, user_id VARCHAR(255) NULL,
  cumulative_months INT NOT NULL DEFAULT 1, streak_months INT NULL, tier VARCHAR(10) NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`).catch(() => {});
ensureTenureTable();
const getTwitchTenure = async (twitchId) => {
  try {
    const [rows] = await pool.query('SELECT cumulative_months FROM twitch_sub_tenure WHERE twitch_id = ?', [twitchId]);
    return Number(rows[0]?.cumulative_months || 0);
  } catch { return 0; }
};
const saveTwitchTenure = async ({ twitchId, cumulative, streak, tier }) => {
  try {
    await ensureTenureTable();
    const [u] = await pool.query('SELECT id FROM users WHERE twitch_id = ?', [twitchId]);
    await pool.query(`INSERT INTO twitch_sub_tenure (twitch_id, user_id, cumulative_months, streak_months, tier)
      VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE user_id = VALUES(user_id),
      cumulative_months = GREATEST(cumulative_months, VALUES(cumulative_months)),
      streak_months = VALUES(streak_months), tier = VALUES(tier)`,
      [twitchId, u[0]?.id || null, Math.max(1, Number(cumulative) || 1), streak ?? null, tier ?? null]);
  } catch (e) { console.error('Save tenure failed:', e.message); }
};
// Twitch EventSub — listening way: Twitch pushes redemption.add events to POST /eventsub,
// backend auto-grants AC + fulfills. Setup: PUBLIC_BASE_URL (public https) +
// TWITCH_EVENTSUB_SECRET (10-100 chars) + broadcaster token with channel:read:redemptions
// (+ channel:manage:redemptions to auto-fulfill). Subscribe once via POST /eventsub/subscribe.
const verifyEventSub = (req) => {
  const secret = process.env.TWITCH_EVENTSUB_SECRET;
  if (!secret) return false;
  const id = req.headers['twitch-eventsub-message-id'] || '';
  const ts = req.headers['twitch-eventsub-message-timestamp'] || '';
  const sig = req.headers['twitch-eventsub-message-signature'] || '';
  const raw = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body);
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(id + ts + raw).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const grantChannelPoints = async ({ redemptionId, twitchUserId }) => {
  const amount = Number(process.env.CHANNEL_POINTS_AC || 100);
  const [users] = await pool.query('SELECT id FROM users WHERE twitch_id = ?', [twitchUserId]);
  if (users.length === 0) return { granted: false, reason: 'twitch_not_linked' };
  // PK on redemption_id is the dedup lock — concurrent retries can't double-grant
  try {
    await pool.query(
      'INSERT INTO channel_point_claims (redemption_id, user_id, twitch_id, granted_ac) VALUES (?, ?, ?, ?)',
      [redemptionId, users[0].id, twitchUserId, amount]
    );
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return { granted: false, reason: 'duplicate' };
    throw e;
  }
  await pool.query('UPDATE users SET alone_coin = alone_coin + ? WHERE id = ?', [amount, users[0].id]);
  await pool.query('INSERT INTO coin_history (user_id, amount, reason) VALUES (?, ?, ?)', [
    users[0].id,
    amount,
    `twitch channel points +${amount} AC`,
  ]);
  await twitchHelix('patch', '/channel_points/custom_rewards/redemptions', {
    params: { broadcaster_id: process.env.TWITCH_BROADCASTER_ID, reward_id: process.env.TWITCH_CHANNEL_REWARD_ID, id: redemptionId },
    body: { status: 'FULFILLED' },
  }).catch((e) => console.error('Fulfill failed:', e.response?.data || e.message));
  return { granted: true, userId: users[0].id, amount };
};

// Broadcaster grants OUR app (TWITCH_CLIENT_ID) channel scopes so the app token can subscribe.
// 403 "missing proper authorization" = this step was skipped (TTG token authorizes TTG's app, not ours).
// GET /eventsub/authorize (admin) -> { url, redirectUri } — open url as the broadcaster, then click Subscribe.
app.get('/eventsub/authorize', checkAdminAuth, (req, res) => {
  const cid = process.env.TWITCH_CLIENT_ID;
  if (!cid || cid.startsWith('your_')) return res.status(500).json({ error: 'TWITCH_CLIENT_ID not configured' });
  const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (!base.startsWith('https://')) return res.status(500).json({ error: 'PUBLIC_BASE_URL must be https://...' });
  const redirectUri = `${base}/auth/twitch/broadcaster/callback`;
  const scope = 'channel:read:redemptions channel:manage:redemptions channel:read:subscriptions';
  const url = `https://id.twitch.tv/oauth2/authorize?client_id=${encodeURIComponent(cid)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;
  res.json({ url, redirectUri, scope });
});

// OAuth callback for the broadcaster grant above. Register redirectUri in Twitch dev console first.
app.get('/auth/twitch/broadcaster/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('Missing code');
  try {
    const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
    const redirectUri = `${base}/auth/twitch/broadcaster/callback`;
    const tokenRes = await axios.post('https://id.twitch.tv/oauth2/token', new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      code: String(code),
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 8000 });
    const userToken = tokenRes.data.access_token;
    const me = await axios.get('https://api.twitch.tv/helix/users', {
      headers: { Authorization: `Bearer ${userToken}`, 'Client-Id': process.env.TWITCH_CLIENT_ID },
      timeout: 7000,
    });
    const login = me.data?.data?.[0];
    if (login && process.env.TWITCH_BROADCASTER_ID && !String(process.env.TWITCH_BROADCASTER_ID).startsWith('your_') && login.id !== String(process.env.TWITCH_BROADCASTER_ID)) {
      return res.status(400).send(`Authorized as ${login.login} (${login.id}) but TWITCH_BROADCASTER_ID=${process.env.TWITCH_BROADCASTER_ID}. Log in as the broadcaster.`);
    }
    broadcasterToken = userToken;
    broadcasterClientId = process.env.TWITCH_CLIENT_ID;
    console.log(`✅ Broadcaster ${login?.login} authorized app ${process.env.TWITCH_CLIENT_ID}`);
    res.send('<h2>Broadcaster authorized ✅</h2><p>Close this tab, go back to admin and click <b>Subscribe EventSub</b>.</p>');
  } catch (e) {
    console.error('Broadcaster Authorize Error:', e.response?.data || e.message);
    res.status(500).send('Authorization failed: ' + (e.response?.data?.message || e.message));
  }
});

app.post('/eventsub', async (req, res) => {
  if (!verifyEventSub(req)) return res.sendStatus(403);
  const type = req.headers['twitch-eventsub-message-type'];
  if (type === 'webhook_callback_verification') return res.status(200).send(req.body.challenge);
  if (type === 'revocation') {
    console.error('EventSub revoked:', req.body?.subscription?.type);
    return res.sendStatus(200);
  }
  res.sendStatus(200); // ack fast (Twitch requires <10s), grant in background
  try {
    const subType = req.body?.subscription?.type;
    const ev = req.body.event || {};
    if (subType === 'channel.subscription.message') {
      await saveTwitchTenure({ twitchId: ev.user_id, cumulative: ev.cumulative_months, streak: ev.streak_months ?? ev.duration_months ?? null, tier: ev.tier });
      return;
    }
    if (subType === 'channel.subscribe') {
      await saveTwitchTenure({ twitchId: ev.user_id, cumulative: ev.cumulative_months ?? 1, streak: ev.streak_months ?? null, tier: ev.tier });
      return;
    }
    if (subType !== 'channel.channel_points_custom_reward_redemption.add') return;
    const configured = process.env.TWITCH_CHANNEL_REWARD_ID;
    if (configured && !configured.startsWith('your_') && ev.reward?.id !== configured) return;
    if (ev.status && ev.status !== 'unfulfilled') return;
    await grantChannelPoints({ redemptionId: ev.id, twitchUserId: ev.user_id });
  } catch (e) {
    console.error('EventSub grant failed:', e.message);
  }
});

// Create the webhook subscription (call once after deploy / secret rotation)
// POST /eventsub/subscribe (admin)
app.post('/eventsub/subscribe', checkAdminAuth, async (req, res) => {
  try {
    const secret = process.env.TWITCH_EVENTSUB_SECRET;
    if (!secret || secret.length < 10 || secret.length > 100)
      return res.status(500).json({ error: 'TWITCH_EVENTSUB_SECRET must be 10-100 chars' });
    const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
    if (!base.startsWith('https://')) return res.status(500).json({ error: 'PUBLIC_BASE_URL must be https://...' });
    // ponytail: no reward_id filter — rewards created via dashboard/TTG belong to another client ID and cause 403; filter by reward in /eventsub handler instead
    const mk = (type, version, condition) => twitchHelixApp('post', '/eventsub/subscriptions', {
      body: { type, version, condition, transport: { method: 'webhook', callback: `${base}/eventsub`, secret } },
    });
    const bid = String(process.env.TWITCH_BROADCASTER_ID);
    const results = [];
    results.push(await mk('channel.channel_points_custom_reward_redemption.add', '1', { broadcaster_user_id: bid }));
    try { results.push(await mk('channel.subscription.message', '1', { broadcaster_user_id: bid })); } catch (e) { results.push({ error: e.response?.data?.message || e.message }); }
    try { results.push(await mk('channel.subscribe', '1', { broadcaster_user_id: bid })); } catch (e) { results.push({ error: e.response?.data?.message || e.message }); }
    res.status(202).json({ data: results });
  } catch (error) {
    console.error('EventSub Subscribe Error:', error.response?.data || error.message);
    const upstream = error.response?.status;
    const detail = error.response?.data?.message || error.message || 'Failed to subscribe';
    const hint = upstream === 403
      ? ' — broadcaster has not authorized THIS app: open GET /eventsub/authorize as the broadcaster first (register its redirectUri in Twitch dev console), then Subscribe again.'
      : '';
    res.status(upstream === 408 ? 504 : upstream || error.status || 500).json({ error: detail + hint });
  }
});

// List active EventSub subscriptions — GET /eventsub/subscriptions (admin)
app.get('/eventsub/subscriptions', checkAdminAuth, async (req, res) => {
  try {
    res.json(await twitchHelixApp('get', '/eventsub/subscriptions', {}));
  } catch (error) {
    const upstream = error.response?.status;
    res.status(upstream === 408 ? 504 : upstream || error.status || 500).json({ error: error.response?.data?.message || error.message || 'Failed to list subscriptions' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
