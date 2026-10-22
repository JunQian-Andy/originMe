const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const config = require('./config');

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      openid TEXT UNIQUE,
      nickname TEXT,
      avatar TEXT,
      role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'user')),
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS login_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      ip TEXT,
      user_agent TEXT,
      login_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS document_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      storage_path TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      type_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      owner_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (type_id) REFERENCES document_types(id) ON DELETE RESTRICT,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      level TEXT NOT NULL CHECK(level IN ('view', 'edit', 'admin')),
      UNIQUE(document_id, user_id),
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function seedDefaults() {
  const existingAdmin = db.prepare("SELECT id FROM users WHERE username = ?").get(config.defaultAdmin.username);
  if (!existingAdmin) {
    const hash = bcrypt.hashSync(config.defaultAdmin.password, 10);
    db.prepare(
      "INSERT INTO users (username, password_hash, nickname, role, status) VALUES (?, ?, ?, ?, ?)"
    ).run(config.defaultAdmin.username, hash, 'Administrator', 'admin', 'active');
    console.log(`Default admin created: ${config.defaultAdmin.username}`);
  }

  const types = [
    { name: 'word', storage_path: 'word' },
    { name: 'excel', storage_path: 'excel' },
    { name: 'ppt', storage_path: 'ppt' },
    { name: 'pdf', storage_path: 'pdf' },
  ];
  for (const t of types) {
    const exists = db.prepare("SELECT id FROM document_types WHERE name = ?").get(t.name);
    if (!exists) {
      db.prepare("INSERT INTO document_types (name, storage_path) VALUES (?, ?)").run(t.name, t.storage_path);
    }
  }

  const onlyOfficeKey = 'onlyoffice_server_url';
  const existingConfig = db.prepare("SELECT key FROM project_config WHERE key = ?").get(onlyOfficeKey);
  if (!existingConfig) {
    db.prepare("INSERT INTO project_config (key, value) VALUES (?, ?)").run(onlyOfficeKey, config.onlyOfficeServerUrl);
  }
}

initTables();
seedDefaults();

module.exports = db;
