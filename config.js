require('dotenv').config();

const path = require('path');

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  sessionSecret: process.env.SESSION_SECRET || 'default_secret_change_me',
  onlyOfficeServerUrl: process.env.ONLYOFFICE_SERVER_URL || 'http://localhost:8081',
  onlyOfficeProxyTarget: process.env.ONLYOFFICE_PROXY_TARGET || 'http://localhost:8081',
  onlyOfficeCallbackHost: process.env.ONLYOFFICE_CALLBACK_HOST || '',
  onlyOfficeJwtSecret: process.env.ONLYOFFICE_JWT_SECRET || '',
  defaultAdmin: {
    username: process.env.DEFAULT_ADMIN_USERNAME || 'admin',
    password: process.env.DEFAULT_ADMIN_PASSWORD || 'admin',
  },
  uploadRoot: path.resolve(__dirname, 'uploads'),
  dbPath: path.resolve(__dirname, 'data.sqlite'),
  sessionDbPath: path.resolve(__dirname, 'sessions.sqlite'),
};

module.exports = config;
