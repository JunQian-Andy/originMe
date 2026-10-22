/**
 * 重置指定账号的密码（直接更新 data.sqlite）
 * 用法: node reset-password.js <账号> <新密码>
 * 例:   node reset-password.js admin admin123
 */
const path = require('path');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const [, , username, newPassword] = process.argv;

if (!username || !newPassword) {
  console.error('用法: node reset-password.js <账号> <新密码>');
  process.exit(1);
}
if (newPassword.length < 6) {
  console.error('密码长度不能少于 6 位');
  process.exit(1);
}

const db = new Database(path.resolve(__dirname, 'data.sqlite'));
const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
if (!user) {
  console.error(`账号 "${username}" 不存在`);
  process.exit(1);
}

const hash = bcrypt.hashSync(newPassword, 10);
db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
  .run(hash, user.id);
db.close();

console.log(`✅ 账号 "${username}" 的密码已重置`);
