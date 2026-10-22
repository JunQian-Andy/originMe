const db = require('../db');

function getDocument(docId) {
  return db.prepare('SELECT * FROM documents WHERE id = ?').get(docId);
}

function getPermission(userId, docId) {
  const doc = getDocument(docId);
  if (!doc) return null;
  if (doc.owner_id === userId) return 'admin';

  const row = db.prepare(
    'SELECT level FROM permissions WHERE document_id = ? AND user_id = ?'
  ).get(docId, userId);

  return row ? row.level : null;
}

function canView(userId, docId) {
  return getPermission(userId, docId) !== null;
}

function canEdit(userId, docId) {
  const level = getPermission(userId, docId);
  return level === 'edit' || level === 'admin';
}

function canAdmin(userId, docId) {
  return getPermission(userId, docId) === 'admin';
}

function setPermission(docId, targetUserId, level) {
  const doc = getDocument(docId);
  if (!doc) {
    throw new Error('文档不存在');
  }
  if (doc.owner_id === targetUserId) {
    throw new Error('不能修改文档所有者的权限');
  }

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(targetUserId);
  if (!user) {
    throw new Error('目标用户不存在');
  }

  if (level === null) {
    db.prepare(
      'DELETE FROM permissions WHERE document_id = ? AND user_id = ?'
    ).run(docId, targetUserId);
    return { deleted: true };
  }

  if (!['view', 'edit', 'admin'].includes(level)) {
    throw new Error('无效的权限级别');
  }

  const existing = db.prepare(
    'SELECT id FROM permissions WHERE document_id = ? AND user_id = ?'
  ).get(docId, targetUserId);

  if (existing) {
    db.prepare(
      'UPDATE permissions SET level = ? WHERE document_id = ? AND user_id = ?'
    ).run(level, docId, targetUserId);
  } else {
    db.prepare(
      'INSERT INTO permissions (document_id, user_id, level) VALUES (?, ?, ?)'
    ).run(docId, targetUserId, level);
  }

  return { updated: true };
}

module.exports = {
  getPermission,
  canView,
  canEdit,
  canAdmin,
  setPermission,
};
