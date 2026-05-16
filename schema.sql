CREATE DATABASE IF NOT EXISTS noteflow
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE noteflow;

CREATE TABLE IF NOT EXISTS users (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  email      VARCHAR(150) NOT NULL UNIQUE,
  password   VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notes (
  id         VARCHAR(36)  PRIMARY KEY,
  user_id    INT          NOT NULL DEFAULT 1,
  title      VARCHAR(255) NOT NULL DEFAULT 'Untitled',
  body       LONGTEXT,
  tags       TEXT,
  pinned     TINYINT(1)   DEFAULT 0,
  archived   TINYINT(1)   DEFAULT 0,
  created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_updated (user_id, updated_at DESC),
  FULLTEXT idx_search (title, body)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO users (id, name, email, password) VALUES
  (1, 'Admin User', 'admin@noteflow.app', '$2b$10$placeholder_bcrypt_hash');

INSERT IGNORE INTO notes (id, user_id, title, body, tags, pinned) VALUES
  ('demo-001', 1, 'Welcome to Noteflow',
   '<h1>Welcome!</h1><p>This is your first note.</p>',
   '["welcome","tutorial"]', 1),
  ('demo-002', 1, 'Meeting Notes',
   '<h2>Action Items</h2><ul><li>Review roadmap</li></ul>',
   '["work","meetings"]', 0);
