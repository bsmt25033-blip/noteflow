const express = require('express');
const mysql   = require('mysql2/promise');
const cors    = require('cors');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let db;
(async () => {
  db = await mysql.createPool({
    host:     process.env.DB_HOST || 'localhost',
    user:     process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'noteflow',
    waitForConnections: true,
    connectionLimit: 10,
  });

  await db.execute(`
    CREATE TABLE IF NOT EXISTS notes (
      id         VARCHAR(36)  PRIMARY KEY,
      user_id    INT          NOT NULL DEFAULT 1,
      title      VARCHAR(255) NOT NULL DEFAULT 'Untitled',
      body       LONGTEXT,
      tags       TEXT,
      pinned     TINYINT(1)   DEFAULT 0,
      archived   TINYINT(1)   DEFAULT 0,
      created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('Database connected & table ready');
})();

function parseNote(row) {
  return {
    id:       row.id,
    title:    row.title,
    body:     row.body || '',
    tags:     row.tags ? JSON.parse(row.tags) : [],
    pinned:   !!row.pinned,
    archived: !!row.archived,
    created:  row.created_at,
    updated:  row.updated_at,
  };
}

app.get('/api/notes', async (req, res) => {
  try {
    const { q = '', filter = 'all', user_id = 1 } = req.query;
    let sql = 'SELECT * FROM notes WHERE user_id = ?';
    const params = [user_id];

    if (filter === 'pinned')   { sql += ' AND pinned = 1';   }
    if (filter === 'archived') { sql += ' AND archived = 1'; }
    if (filter === 'all')      { sql += ' AND archived = 0'; }

    if (q) {
      sql += ' AND (title LIKE ? OR body LIKE ? OR tags LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    sql += ' ORDER BY pinned DESC, updated_at DESC';
    const [rows] = await db.execute(sql, params);
    res.json(rows.map(parseNote));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

app.get('/api/notes/:id', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM notes WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Note not found' });
    res.json(parseNote(rows[0]));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch note' });
  }
});

app.post('/api/notes', async (req, res) => {
  try {
    const { id, title = 'Untitled', body = '', tags = [], pinned = false, archived = false, user_id = 1 } = req.body;
    await db.execute(
      'INSERT INTO notes (id, user_id, title, body, tags, pinned, archived) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, user_id, title, body, JSON.stringify(tags), pinned ? 1 : 0, archived ? 1 : 0]
    );
    res.status(201).json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create note' });
  }
});

app.put('/api/notes/:id', async (req, res) => {
  try {
    const { title, body, tags, pinned, archived } = req.body;
    const [result] = await db.execute(
      `UPDATE notes SET
        title    = COALESCE(?, title),
        body     = COALESCE(?, body),
        tags     = COALESCE(?, tags),
        pinned   = COALESCE(?, pinned),
        archived = COALESCE(?, archived)
       WHERE id = ?`,
      [
        title ?? null,
        body  ?? null,
        tags  !== undefined ? JSON.stringify(tags) : null,
        pinned   !== undefined ? (pinned   ? 1 : 0) : null,
        archived !== undefined ? (archived ? 1 : 0) : null,
        req.params.id,
      ]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Note not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update note' });
  }
});

app.delete('/api/notes/:id', async (req, res) => {
  try {
    await db.execute('DELETE FROM notes WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

app.listen(PORT, () => {
  console.log(`Noteflow server running at http://localhost:${PORT}`);
});
