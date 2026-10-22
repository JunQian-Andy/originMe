const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../db');
const config = require('../config');
const permissionService = require('../services/permission');
const storageService = require('../services/storage');
const jwtService = require('../services/jwt');
const networkService = require('../services/network');

const router = express.Router();

const upload = multer({
  dest: path.join(__dirname, '..', 'uploads', '.tmp'),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const allowed = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'pdf'];
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('仅支持 Word(doc/docx)、Excel(xls/xlsx)、PPT(ppt/pptx)、PDF(pdf) 文件'));
    }
  },
});

function getOnlyOfficeDocumentType(ext) {
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'cell';
  if (['ppt', 'pptx'].includes(ext)) return 'slide';
  // PDF 由 OnlyOffice 的文字处理器打开（7.1+ 支持 PDF 查看，7.4+ 支持编辑）
  return 'word';
}

function getOnlyOfficeFileType(ext) {
  if (['doc', 'docx'].includes(ext)) return 'docx';
  if (['xls', 'xlsx'].includes(ext)) return 'xlsx';
  if (['ppt', 'pptx'].includes(ext)) return 'pptx';
  if (ext === 'pdf') return 'pdf';
  return ext;
}

// 文件后缀 → 文档类型名（对应 document_types 表的 name 字段：word/excel/ppt/pdf）
const EXT_TO_TYPE_NAME = {
  doc: 'word', docx: 'word',
  xls: 'excel', xlsx: 'excel',
  ppt: 'ppt', pptx: 'ppt',
  pdf: 'pdf',
};

function docResponse(doc, userId) {
  const type = db.prepare('SELECT * FROM document_types WHERE id = ?').get(doc.type_id);
  const owner = db.prepare('SELECT id, username, nickname FROM users WHERE id = ?').get(doc.owner_id);
  return {
    id: doc.id,
    title: doc.title,
    type_id: doc.type_id,
    type_name: type ? type.name : null,
    filename: doc.filename,
    owner_id: doc.owner_id,
    owner_name: owner ? (owner.nickname || owner.username) : null,
    permission: permissionService.getPermission(userId, doc.id),
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  };
}

router.get('/', (req, res, next) => {
  try {
    const userId = req.user.id;
    const docs = db.prepare(
      `SELECT d.*,
        CASE WHEN d.owner_id = ? THEN 'admin' ELSE p.level END as permission
       FROM documents d
       LEFT JOIN permissions p ON p.document_id = d.id AND p.user_id = ?
       WHERE d.owner_id = ? OR p.user_id IS NOT NULL
       ORDER BY d.updated_at DESC`
    ).all(userId, userId, userId);

    const result = docs.map((doc) => docResponse(doc, userId));
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/', upload.single('file'), (req, res, next) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: '请上传文件' });
    }

    // multer 默认按 latin1 解码文件名，中文 UTF-8 文件名需转回 UTF-8，否则会乱码
    const originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');

    // 按文件后缀自动判定文档类型
    const ext = path.extname(originalname).toLowerCase().slice(1);
    const typeName = EXT_TO_TYPE_NAME[ext];
    if (!typeName) {
      return res.status(400).json({ success: false, message: '仅支持 Word、Excel、PPT、PDF 文件' });
    }
    const type = db.prepare('SELECT * FROM document_types WHERE name = ?').get(typeName);
    if (!type) {
      return res.status(400).json({ success: false, message: '文档类型不存在' });
    }

    // 标题默认为文件名（去掉后缀）
    const docTitle = path.basename(originalname, path.extname(originalname));
    const saved = storageService.saveUploadedFile(file.path, type.id, originalname);

    const result = db.prepare(
      'INSERT INTO documents (title, type_id, filename, owner_id) VALUES (?, ?, ?, ?)'
    ).run(docTitle, type.id, saved.filename, req.user.id);

    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, data: docResponse(doc, req.user.id) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const docId = parseInt(req.params.id, 10);
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId);
    if (!doc) {
      return res.status(404).json({ success: false, message: '文档不存在' });
    }
    if (!permissionService.canView(req.user.id, docId)) {
      return res.status(403).json({ success: false, message: '无权访问该文档' });
    }
    res.json({ success: true, data: docResponse(doc, req.user.id) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    const docId = parseInt(req.params.id, 10);
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId);
    if (!doc) {
      return res.status(404).json({ success: false, message: '文档不存在' });
    }
    if (!permissionService.canAdmin(req.user.id, docId)) {
      return res.status(403).json({ success: false, message: '无权删除该文档' });
    }

    storageService.deleteDocumentFile(doc);
    db.prepare('DELETE FROM documents WHERE id = ?').run(docId);

    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/config', (req, res, next) => {
  try {
    const docId = parseInt(req.params.id, 10);
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId);
    if (!doc) {
      return res.status(404).json({ success: false, message: '文档不存在' });
    }
    if (!permissionService.canView(req.user.id, docId)) {
      return res.status(403).json({ success: false, message: '无权访问该文档' });
    }

    const ext = path.extname(doc.filename).toLowerCase().slice(1);
    const documentType = getOnlyOfficeDocumentType(ext);
    const fileType = getOnlyOfficeFileType(ext);
    const mode = permissionService.canEdit(req.user.id, docId) ? 'edit' : 'view';

    const key = `${doc.id}-${new Date(doc.updated_at).getTime()}`;

    // 按前端来源 IP 所属网段，选择对应的 OnlyOffice 地址与本服务回调地址（双网卡）
    const route = networkService.getRouteByIp(req.ip);
    const baseUrl = (route && route.callbackHost) || config.onlyOfficeCallbackHost || `${req.protocol}://${req.get('host')}`;

    const configRow = db.prepare("SELECT value FROM project_config WHERE key = 'onlyoffice_server_url'").get();
    const serverUrl = (route && route.onlyofficeUrl) || config.onlyOfficeServerUrl || (configRow ? configRow.value : 'http://localhost:8081');
    if (route) {
      console.log(`[OnlyOffice config] 命中网段 ${route.name}(${route.cidr}): serverUrl=${serverUrl}, callbackHost=${baseUrl}`);
    }

    const downloadToken = jwtService.sign(
      { docId: doc.id, exp: Date.now() + 24 * 60 * 60 * 1000 },
      config.onlyOfficeJwtSecret
    );
    const documentUrl = `${baseUrl}/api/onlyoffice/download/${doc.id}?token=${encodeURIComponent(downloadToken)}`;

    const tokenPayload = {
      documentType,
      document: {
        fileType,
        key,
        url: documentUrl,
        title: doc.title,
      },
      editorConfig: {
        callbackUrl: `${baseUrl}/api/onlyoffice/callback/${doc.id}`,
        mode,
        user: {
          id: String(req.user.id),
          name: req.user.nickname || req.user.username,
        },
        lang: 'zh-CN',
      },
    };
    const token = jwtService.sign(tokenPayload, config.onlyOfficeJwtSecret);
    // OnlyOffice 开启 browser token 校验后，document 与 editorConfig 子对象也需各自携带独立签名
    const documentToken = jwtService.sign(tokenPayload.document, config.onlyOfficeJwtSecret);
    const editorConfigToken = jwtService.sign(tokenPayload.editorConfig, config.onlyOfficeJwtSecret);

    console.log(`[OnlyOffice config] baseUrl=${baseUrl}, documentUrl=${documentUrl}, callbackUrl=${baseUrl}/api/onlyoffice/callback/${doc.id}`);

    res.json({
      success: true,
      data: {
        documentType,
        serverUrl,
        token,
        document: {
          fileType,
          key,
          url: documentUrl,
          title: doc.title,
          token: documentToken,
        },
        editorConfig: {
          mode,
          callbackUrl: `${baseUrl}/api/onlyoffice/callback/${doc.id}`,
          user: {
            id: String(req.user.id),
            name: req.user.nickname || req.user.username,
          },
          lang: 'zh-CN',
          token: editorConfigToken,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/permissions', (req, res, next) => {
  try {
    const docId = parseInt(req.params.id, 10);
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId);
    if (!doc) {
      return res.status(404).json({ success: false, message: '文档不存在' });
    }
    if (!permissionService.canAdmin(req.user.id, docId)) {
      return res.status(403).json({ success: false, message: '无权管理该文档权限' });
    }

    const rows = db.prepare(
      `SELECT p.id, p.user_id, p.level, u.username, u.nickname
       FROM permissions p
       JOIN users u ON u.id = p.user_id
       WHERE p.document_id = ?
       ORDER BY p.id`
    ).all(docId);

    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/permissions', (req, res, next) => {
  try {
    const docId = parseInt(req.params.id, 10);
    const { user_id, level } = req.body || {};
    const targetUserId = parseInt(user_id, 10);

    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId);
    if (!doc) {
      return res.status(404).json({ success: false, message: '文档不存在' });
    }
    if (!permissionService.canAdmin(req.user.id, docId)) {
      return res.status(403).json({ success: false, message: '无权管理该文档权限' });
    }

    const normalizedLevel = level === null || level === '' ? null : level;
    permissionService.setPermission(docId, targetUserId, normalizedLevel);

    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
