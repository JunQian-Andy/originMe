const db = require('../db');

function requireLogin(req, res, next) {
  const userId = req.session && req.session.userId;
  if (!userId) {
    return res.status(401).json({ success: false, message: '请先登录' });
  }

  const user = db.prepare(
    'SELECT id, username, nickname, role, status FROM users WHERE id = ?'
  ).get(userId);

  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ success: false, message: '登录已失效，请重新登录' });
  }

  req.user = user;
  next();
}

function requireActive(req, res, next) {
  if (req.user.status !== 'active') {
    req.session.destroy(() => {});
    return res.status(403).json({ success: false, message: '账号已停用' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: '无权访问' });
  }
  next();
}

module.exports = {
  requireLogin,
  requireActive,
  requireAdmin,
};
