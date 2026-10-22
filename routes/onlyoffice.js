const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const config = require('../config');
const { requireLogin, requireActive } = require('../middleware/auth');
const permissionService = require('../services/permission');
const storageService = require('../services/storage');
const jwtService = require('../services/jwt');

const router = express.Router();

const allowedExts = {
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  pdf: 'application/pdf',
  txt: 'text/plain',
};

router.get('/download/:id', (req, res, next) => {
  try {
    const docId = parseInt(req.params.id, 10);
    const downloadToken = req.query.token;
    console.log(`[OnlyOffice download] docId=${docId}, tokenPresent=${!!downloadToken}`);
    if (!downloadToken) {
      console.error(`[OnlyOffice download] missing token for docId=${docId}`);
      return res.status(401).json({ success: false, message: '缺少下载令牌' });
    }

    const payload = jwtService.verify(downloadToken, config.onlyOfficeJwtSecret);
    console.log(`[OnlyOffice download] verifyPayload=${JSON.stringify(payload)}, expectedDocId=${docId}`);
    if (!payload || payload.docId !== docId) {
      console.error(`[OnlyOffice download] invalid token for docId=${docId}`);
      return res.status(403).json({ success: false, message: '下载令牌无效' });
    }
    if (payload.exp && payload.exp < Date.now()) {
      console.error(`[OnlyOffice download] expired token for docId=${docId}`);
      return res.status(403).json({ success: false, message: '下载令牌已过期' });
    }

    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId);
    if (!doc) {
      console.error(`[OnlyOffice download] doc not found: ${docId}`);
      return res.status(404).json({ success: false, message: '文档不存在' });
    }

    const filePath = storageService.resolveDocumentPath(doc);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: '文件不存在' });
    }

    const ext = path.extname(doc.filename).toLowerCase().slice(1);
    const contentType = allowedExts[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(doc.filename)}`);
    res.setHeader('Content-Length', fs.statSync(filePath).size);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
});

router.post('/callback/:id', express.json({ limit: '20mb' }), async (req, res, next) => {
  try {
    const docId = parseInt(req.params.id, 10);
    const { status, url } = req.body || {};

    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId);
    if (!doc) {
      return res.status(404).json({ error: 1, message: '文档不存在' });
    }

    if (status === 0) {
      return res.json({ error: 0 });
    }

    if (status === 1) {
      return res.json({ error: 0 });
    }

    if (status === 2 || status === 6) {
      if (!url) {
        return res.json({ error: 0 });
      }
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`下载失败: ${response.status}`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        const filePath = storageService.resolveDocumentPath(doc);
        fs.writeFileSync(filePath, buffer);
        db.prepare('UPDATE documents SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(docId);
      } catch (fetchErr) {
        console.error('OnlyOffice callback download failed:', fetchErr);
        return res.json({ error: 1, message: fetchErr.message });
      }
      return res.json({ error: 0 });
    }

    if (status === 3 || status === 4 || status === 7) {
      console.log(`OnlyOffice callback status ${status} for doc ${docId}`, req.body);
      return res.json({ error: 0 });
    }

    return res.json({ error: 0 });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
