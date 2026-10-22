const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const config = require('../config');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

const enableDemoLogin = process.env.ENABLE_DEMO_LOGIN === 'true' || config.nodeEnv === 'development';

router.post('/login', (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, message: '请输入账号和密码' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ success: false, message: '账号或密码错误' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: '账号已停用' });
    }

    req.session.userId = user.id;

    db.prepare(
      'INSERT INTO login_records (user_id, ip, user_agent) VALUES (?, ?, ?)'
    ).run(user.id, req.ip || req.socket.remoteAddress, req.headers['user-agent'] || '');

    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/demo-login', (req, res, next) => {
  try {
    if (!enableDemoLogin) {
      return res.status(403).json({ success: false, message: '演示登录已禁用' });
    }

    const { nickname } = req.body || {};
    const name = (nickname || 'Demo User').toString().trim().substring(0, 50);
    if (!name) {
      return res.status(400).json({ success: false, message: '请输入昵称' });
    }

    const usernameBase = 'demo_' + name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
    let username = usernameBase;
    let suffix = 1;
    while (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
      username = `${usernameBase}_${suffix++}`;
    }

    const hash = bcrypt.hashSync('demo_password', 10);
    const result = db.prepare(
      'INSERT INTO users (username, password_hash, nickname, role, status) VALUES (?, ?, ?, ?, ?)'
    ).run(username, hash, name, 'user', 'active');

    const userId = result.lastInsertRowid;
    req.session.userId = userId;

    res.json({
      success: true,
      data: {
        id: userId,
        username,
        nickname: name,
        role: 'user',
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', requireLogin, (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.json({ success: true, data: null });
  });
});

router.get('/me', requireLogin, (req, res) => {
  res.json({
    success: true,
    data: {
      id: req.user.id,
      username: req.user.username,
      nickname: req.user.nickname,
      role: req.user.role,
      avatar: req.user.avatar,
    },
  });
});

router.post('/change-password', requireLogin, (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: '请输入旧密码和新密码' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: '新密码长度不能少于 6 位' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!bcrypt.compareSync(oldPassword, user.password_hash)) {
      return res.status(400).json({ success: false, message: '旧密码错误' });
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hash, user.id);

    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
