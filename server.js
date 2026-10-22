require('dotenv').config();

const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const sqlite3 = require('sqlite3');
const path = require('path');

const { createProxyMiddleware } = require('http-proxy-middleware');

const config = require('./config');
require('./db');

const sessionDb = new sqlite3.Database(config.sessionDbPath);

const authMiddleware = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const documentRoutes = require('./routes/documents');
const onlyofficeRoutes = require('./routes/onlyoffice');

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(session({
  store: new SQLiteStore({ db: sessionDb }),
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
  },
}));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/admin', authMiddleware.requireLogin, authMiddleware.requireActive, authMiddleware.requireAdmin, adminRoutes);
app.use('/api/documents', authMiddleware.requireLogin, authMiddleware.requireActive, documentRoutes);
app.use('/api/onlyoffice', onlyofficeRoutes);

app.use('/onlyoffice', createProxyMiddleware({
  target: config.onlyOfficeProxyTarget,
  changeOrigin: true,
  ws: true,
  pathRewrite: { '^/onlyoffice': '' },
}));

app.use((req, res) => {
  res.status(404).json({ success: false, message: '接口不存在' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || '服务器内部错误',
  });
});

app.listen(config.port, '0.0.0.0', () => {
  console.log(`Server is running at http://0.0.0.0:${config.port}`);
});
