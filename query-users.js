/**
 * 查询 data.sqlite 中所有用户账号信息
 * 用法: node query-users.js [要验证的密码，默认 "admin"]
 *
 * 说明: 密码以 bcrypt 哈希存储，无法还原明文。
 * 本脚本列出所有账号，并验证指定密码与每个哈希是否匹配，
 * 帮助排查 "admin/admin 无法登录" 的问题。
 * 优先使用系统 sqlite3 命令（更稳定），查不到才退回 better-sqlite3。
 */
const path = require('path');
const { execFileSync } = require('child_process');
const bcrypt = require('bcryptjs');

const DB = path.resolve(__dirname, 'data.sqlite');
const testPassword = process.argv[2] || 'admin';

function loadUsers() {
  // 方式一: 系统 sqlite3 命令行（macOS 自带）
  try {
    const out = execFileSync('sqlite3', ['-json', DB,
      'SELECT id, username, password_hash, nickname, role, status, created_at FROM users ORDER BY id;'
    ], { encoding: 'utf8' });
    return JSON.parse(out || '[]');
  } catch (e) {
    // 方式二: better-sqlite3（若原生模块与 Node 版本不匹配可能段错误）
    const Database = require('better-sqlite3');
    const db = new Database(DB);
    const rows = db.prepare(
      'SELECT id, username, password_hash, nickname, role, status, created_at FROM users ORDER BY id'
    ).all();
    db.close();
    return rows;
  }
}

const users = loadUsers();

if (users.length === 0) {
  console.log('users 表为空，还没有任何账号。');
  process.exit(0);
}

console.log(`共 ${users.length} 个账号，验证密码 "${testPassword}"：\n`);

for (const u of users) {
  const match = bcrypt.compareSync(testPassword, u.password_hash);
  console.log('─'.repeat(60));
  console.log(`ID:       ${u.id}`);
  console.log(`账号:     ${u.username}`);
  console.log(`昵称:     ${u.nickname}`);
  console.log(`角色:     ${u.role}`);
  console.log(`状态:     ${u.status}${u.status !== 'active' ? '  ← 注意: 非 active 状态会被拒绝登录' : ''}`);
  console.log(`密码哈希: ${u.password_hash}`);
  console.log(`创建于:   ${u.created_at}`);
  console.log(`验证 "${testPassword}": ${match ? '✅ 匹配' : '❌ 不匹配'}`);
}

console.log('\n' + '═'.repeat(60));
console.log('排查建议:');
console.log('1. 显示 "❌ 不匹配" → 数据库里的密码不是 ' + testPassword + '，运行 node reset-password.js <账号> <新密码> 重置');
console.log('2. 状态不是 active → 账号被停用，登录会返回 403');
console.log('3. 表为空 → 删除 data.sqlite 后重启服务，会按 .env 重建 admin');
