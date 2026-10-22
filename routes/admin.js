const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');

const router = express.Router();

function userResponse(user) {
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    role: user.role,
    status: user.status,
    openid: user.openid,
    avatar: user.avatar,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

router.get('/users', (req, res, next) => {
  try {
    const users = db.prepare(
      'SELECT id, username, nickname, role, status, openid, avatar, created_at, updated_at FROM users ORDER BY id DESC'
    ).all();
    res.json({ success: true, data: users.map(userResponse) });
  } catch (err) {
    next(err);
  }
});

router.post('/users', (req, res, next) => {
  try {
    const { username, password, nickname, role, status } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, message: '请输入账号和密码' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: '密码长度不能少于 6 位' });
    }

    const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (exists) {
      return res.status(409).json({ success: false, message: '账号已存在' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(
      'INSERT INTO users (username, password_hash, nickname, role, status) VALUES (?, ?, ?, ?, ?)'
    ).run(username, hash, nickname || username, role === 'admin' ? 'admin' : 'user', status === 'inactive' ? 'inactive' : 'active');

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: userResponse(user) });
  } catch (err) {
    next(err);
  }
});

router.put('/users/:id', (req, res, next) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { nickname, role, status } = req.body || {};

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    if (req.user.id === userId) {
      if (role && role !== user.role) {
        return res.status(400).json({ success: false, message: '不能修改自己的角色' });
      }
      if (status === 'inactive') {
        return res.status(400).json({ success: false, message: '不能停用自己' });
      }
    }

    if (status === 'inactive' || (role && role !== 'admin')) {
      const count = db.prepare(
        "SELECT COUNT(*) as cnt FROM users WHERE role = 'admin' AND status = 'active'"
      ).get().cnt;
      const willReduceAdmin = user.role === 'admin' && (role === 'user' || status === 'inactive');
      if (willReduceAdmin && count <= 1) {
        return res.status(400).json({ success: false, message: '至少需要保留一个活跃的系统管理员' });
      }
    }

    const updates = [];
    const params = [];
    if (nickname !== undefined) {
      updates.push('nickname = ?');
      params.push(nickname);
    }
    if (role !== undefined) {
      updates.push('role = ?');
      params.push(role === 'admin' ? 'admin' : 'user');
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status === 'inactive' ? 'inactive' : 'active');
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: '没有可更新的字段' });
    }

    params.push(userId);
    db.prepare(`UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...params);

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    res.json({ success: true, data: userResponse(updated) });
  } catch (err) {
    next(err);
  }
});

router.post('/users/:id/reset-password', (req, res, next) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { newPassword } = req.body || {};
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: '新密码长度不能少于 6 位' });
    }

    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hash, userId);

    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
});

router.get('/document-types', (req, res, next) => {
  try {
    const types = db.prepare('SELECT * FROM document_types ORDER BY id').all();
    res.json({ success: true, data: types });
  } catch (err) {
    next(err);
  }
});

router.post('/document-types', (req, res, next) => {
  try {
    const { name, storage_path } = req.body || {};
    if (!name || !storage_path) {
      return res.status(400).json({ success: false, message: '请输入类型名称和存储路径' });
    }

    const exists = db.prepare('SELECT id FROM document_types WHERE name = ?').get(name);
    if (exists) {
      return res.status(409).json({ success: false, message: '文档类型已存在' });
    }

    const result = db.prepare(
      'INSERT INTO document_types (name, storage_path) VALUES (?, ?)'
    ).run(name, storage_path);

    const type = db.prepare('SELECT * FROM document_types WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: type });
  } catch (err) {
    next(err);
  }
});

router.put('/document-types/:id', (req, res, next) => {
  try {
    const typeId = parseInt(req.params.id, 10);
    const { name, storage_path } = req.body || {};

    const type = db.prepare('SELECT * FROM document_types WHERE id = ?').get(typeId);
    if (!type) {
      return res.status(404).json({ success: false, message: '文档类型不存在' });
    }

    const updates = [];
    const params = [];
    if (name !== undefined) {
      const exists = db.prepare('SELECT id FROM document_types WHERE name = ? AND id != ?').get(name, typeId);
      if (exists) {
        return res.status(409).json({ success: false, message: '文档类型名称已存在' });
      }
      updates.push('name = ?');
      params.push(name);
    }
    if (storage_path !== undefined) {
      updates.push('storage_path = ?');
      params.push(storage_path);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: '没有可更新的字段' });
    }

    params.push(typeId);
    db.prepare(`UPDATE document_types SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...params);

    const updated = db.prepare('SELECT * FROM document_types WHERE id = ?').get(typeId);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

router.delete('/document-types/:id', (req, res, next) => {
  try {
    const typeId = parseInt(req.params.id, 10);
    const type = db.prepare('SELECT * FROM document_types WHERE id = ?').get(typeId);
    if (!type) {
      return res.status(404).json({ success: false, message: '文档类型不存在' });
    }

    const docCount = db.prepare('SELECT COUNT(*) as cnt FROM documents WHERE type_id = ?').get(typeId).cnt;
    if (docCount > 0) {
      return res.status(400).json({ success: false, message: '该类型下存在文档，无法删除' });
    }

    db.prepare('DELETE FROM document_types WHERE id = ?').run(typeId);
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
});

router.get('/config', (req, res, next) => {
  try {
    const rows = db.prepare('SELECT * FROM project_config').all();
    const configObj = {};
    for (const row of rows) {
      configObj[row.key] = row.value;
    }
    res.json({ success: true, data: configObj });
  } catch (err) {
    next(err);
  }
});

router.put('/config', (req, res, next) => {
  try {
    const updates = req.body || {};
    const allowedKeys = ['onlyoffice_server_url'];
    const entries = Object.entries(updates).filter(([key]) => allowedKeys.includes(key));

    if (entries.length === 0) {
      return res.status(400).json({ success: false, message: '没有可更新的配置' });
    }

    const insert = db.prepare(
      'INSERT INTO project_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP'
    );
    for (const [key, value] of entries) {
      insert.run(key, String(value));
    }

    const rows = db.prepare('SELECT * FROM project_config').all();
    const configObj = {};
    for (const row of rows) {
      configObj[row.key] = row.value;
    }
    res.json({ success: true, data: configObj });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
