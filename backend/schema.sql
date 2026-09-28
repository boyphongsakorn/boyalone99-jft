-- Create Database
CREATE DATABASE IF NOT EXISTS boyalone99_community;
USE boyalone99_community;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    avatar VARCHAR(255),
    alone_coin INT DEFAULT 0,
    epic_username VARCHAR(255) NULL,
    twitch_id VARCHAR(255) NULL,
    twitch_username VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rewards Table
CREATE TABLE IF NOT EXISTS rewards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    cost INT NOT NULL,
    accent VARCHAR(50),
    icon VARCHAR(10),
    stock INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Redemption History Table
CREATE TABLE IF NOT EXISTS redemption_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    reward_id INT NOT NULL,
    redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (reward_id) REFERENCES rewards(id)
);

-- Channel-point redemptions already converted to AC (prevents double-spend)
CREATE TABLE IF NOT EXISTS channel_point_claims (
    redemption_id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    twitch_id VARCHAR(255) NOT NULL,
    granted_ac INT NOT NULL,
    claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Claimed follow rewards (one claim per user per platform)
CREATE TABLE IF NOT EXISTS claimed_follows (
    user_id VARCHAR(255) NOT NULL,
    platform VARCHAR(50) NOT NULL,
    claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, platform),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Site Settings Table
CREATE TABLE IF NOT EXISTS settings (
    `key` VARCHAR(255) PRIMARY KEY,
    `value` VARCHAR(255) NOT NULL
);

INSERT IGNORE INTO settings (`key`, `value`) VALUES ('claim_enabled', '1');
INSERT IGNORE INTO settings (`key`, `value`) VALUES ('alert_enabled', '0');
INSERT IGNORE INTO settings (`key`, `value`) VALUES ('alert_message', '');

-- Coin Transaction History Table
CREATE TABLE IF NOT EXISTS coin_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    amount INT NOT NULL,
    reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Initial Rewards Data
INSERT INTO rewards (title, description, cost, accent, icon, stock) VALUES
('Alone Sticker Pack', 'A set of tiny stickers for your digital corner.', 50, 'peach', '✦', 100),
('Community Shout-out', 'Get your name on the next community thank-you wall.', 100, 'mint', '♡', 20),
('Behind-the-scenes Note', 'A personal note from BoyAlone99, just for you.', 150, 'lilac', '✎', 10),
('Alone Limited Badge', 'A special badge for early members of the community.', 200, 'gold', '◇', 5),
('Steam Gift: Papers, Please', 'A surprise game from the Steam store, chosen for you.', 250, 'peach', '🎮', 3),
('Fortnite Battle Pass', 'Unlock the current season pass for Fortnite.', 275, 'mint', '🏆', 15),
('Steam Gift: Warframe The Old Peace Uriel Bundle', 'A special game bundle for the dedicated community members.', 300, 'gold', '💎', 2);
