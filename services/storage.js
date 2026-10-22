const fs = require('fs');
const path = require('path');
const db = require('../db');
const config = require('../config');

function sanitizeFilename(name) {
  return name
    .replace(/[\\/:*?"<>>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 200);
}

function getExtension(name) {
  const ext = path.extname(name).toLowerCase();
  return ext ? ext.slice(1) : '';
}

function generateFilename(originalName) {
  const ext = getExtension(originalName);
  const base = path.basename(originalName, ext ? `.${ext}` : '');
  const safeBase = sanitizeFilename(base) || 'file';
  const random = Math.random().toString(36).substring(2, 10);
  return `${Date.now()}_${random}_${safeBase}.${ext || 'bin'}`;
}

function getStorageDir(typeId) {
  const type = db.prepare('SELECT * FROM document_types WHERE id = ?').get(typeId);
  if (!type) {
    throw new Error('文档类型不存在');
  }
  return path.resolve(config.uploadRoot, type.storage_path);
}

function ensureUploadDir(typeId) {
  const dir = getStorageDir(typeId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function resolveDocumentPath(doc) {
  const type = db.prepare('SELECT * FROM document_types WHERE id = ?').get(doc.type_id);
  if (!type) {
    throw new Error('文档类型不存在');
  }
  return path.resolve(config.uploadRoot, type.storage_path, doc.filename);
}

function saveUploadedFile(tmpPath, typeId, originalName) {
  const dir = ensureUploadDir(typeId);
  const filename = generateFilename(originalName);
  const destPath = path.join(dir, filename);
  fs.renameSync(tmpPath, destPath);
  return { filename, absolutePath: destPath };
}

function deleteDocumentFile(doc) {
  const filePath = resolveDocumentPath(doc);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

module.exports = {
  getExtension,
  generateFilename,
  getStorageDir,
  ensureUploadDir,
  resolveDocumentPath,
  saveUploadedFile,
  deleteDocumentFile,
};
