const messageEl = document.getElementById('message');

function showMessage(text, type = 'error') {
  messageEl.innerHTML = `\u003cdiv class="message ${type}">${text}\u003c/div\u003e`;
  setTimeout(() => { messageEl.innerHTML = ''; }, 5000);
}

function formatDate(str) {
  if (!str) return '-';
  const d = new Date(str);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

async function init() {
  try {
    await api.auth.me();
    await loadUsers();
    await loadTypes();
    await loadConfig();
  } catch (err) {
    showMessage(err.message);
  }
}

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
  });
});

async function loadUsers() {
  const users = await api.admin.users.list();
  const html = `
    \u003ctable class="doc-list">
      \u003cthead\u003e
        \u003ctr\u003e
          \u003cth\u003eID\u003c/th\u003e
          \u003cth\u003e账号\u003c/th\u003e
          \u003cth\u003e昵称\u003c/th\u003e
          \u003cth\u003e角色\u003c/th\u003e
          \u003cth\u003e状态\u003c/th\u003e
          \u003cth\u003e创建时间\u003c/th\u003e
          \u003cth\u003e操作\u003c/th\u003e
        \u003c/tr\u003e
      \u003c/thead\u003e
      \u003ctbody\u003e
        ${users.map((u) => `
          \u003ctr\u003e
            \u003ctd\u003e${u.id}\u003c/td\u003e
            \u003ctd\u003e${u.username}\u003c/td\u003e
            \u003ctd\u003e${u.nickname || '-'}\u003c/td\u003e
            \u003ctd\u003e${u.role === 'admin' ? '管理员' : '用户'}\u003c/td\u003e
            \u003ctd\u003e${u.status === 'active' ? '正常' : '停用'}\u003c/td\u003e
            \u003ctd\u003e${formatDate(u.created_at)}\u003c/td\u003e
            \u003ctd\u003e
              \u003cbutton class="secondary" onclick="editUser(${u.id}, '${u.nickname || ''}', '${u.role}', '${u.status}')">编辑\u003c/button\u003e
              \u003cbutton class="secondary" onclick="openResetPassword(${u.id})">重置密码\u003c/button\u003e
            \u003c/td\u003e
          \u003c/tr\u003e
        `).join('')}
      \u003c/tbody\u003e
    \u003c/table\u003e
  `;
  document.getElementById('users-list').innerHTML = html;
}

document.getElementById('create-user-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = {
    username: document.getElementById('new-username').value.trim(),
    password: document.getElementById('new-password').value,
    nickname: document.getElementById('new-nickname').value.trim(),
    role: document.getElementById('new-role').value,
  };
  try {
    await api.admin.users.create(user);
    e.target.reset();
    await loadUsers();
    showMessage('用户创建成功', 'success');
  } catch (err) {
    showMessage(err.message);
  }
});

window.editUser = function (id, nickname, role, status) {
  document.getElementById('edit-user-id').value = id;
  document.getElementById('edit-user-nickname').value = nickname;
  document.getElementById('edit-user-role').value = role;
  document.getElementById('edit-user-status').value = status;
  document.getElementById('edit-user-modal').style.display = 'flex';
};

document.getElementById('btn-cancel-edit-user').addEventListener('click', () => {
  document.getElementById('edit-user-modal').style.display = 'none';
});

document.getElementById('btn-save-user').addEventListener('click', async () => {
  const id = parseInt(document.getElementById('edit-user-id').value, 10);
  const updates = {
    nickname: document.getElementById('edit-user-nickname').value.trim(),
    role: document.getElementById('edit-user-role').value,
    status: document.getElementById('edit-user-status').value,
  };
  try {
    await api.admin.users.update(id, updates);
    document.getElementById('edit-user-modal').style.display = 'none';
    await loadUsers();
    showMessage('用户更新成功', 'success');
  } catch (err) {
    showMessage(err.message);
  }
});

window.openResetPassword = function (id) {
  document.getElementById('reset-user-id').value = id;
  document.getElementById('reset-password').value = '';
  document.getElementById('reset-password-modal').style.display = 'flex';
};

document.getElementById('btn-cancel-reset').addEventListener('click', () => {
  document.getElementById('reset-password-modal').style.display = 'none';
});

document.getElementById('btn-confirm-reset').addEventListener('click', async () => {
  const id = parseInt(document.getElementById('reset-user-id').value, 10);
  const newPassword = document.getElementById('reset-password').value;
  try {
    await api.admin.users.resetPassword(id, newPassword);
    document.getElementById('reset-password-modal').style.display = 'none';
    showMessage('密码重置成功', 'success');
  } catch (err) {
    showMessage(err.message);
  }
});

async function loadTypes() {
  const types = await api.admin.documentTypes.list();
  const html = `
    \u003ctable class="doc-list">
      \u003cthead\u003e
        \u003ctr\u003e
          \u003cth\u003eID\u003c/th\u003e
          \u003cth\u003e名称\u003c/th\u003e
          \u003cth\u003e存储路径\u003c/th\u003e
          \u003cth\u003e操作\u003c/th\u003e
        \u003c/tr\u003e
      \u003c/thead\u003e
      \u003ctbody\u003e
        ${types.map((t) => `
          \u003ctr\u003e
            \u003ctd\u003e${t.id}\u003c/td\u003e
            \u003ctd\u003e${t.name}\u003c/td\u003e
            \u003ctd\u003e${t.storage_path}\u003c/td\u003e
            \u003ctd\u003e
              \u003cbutton class="danger" onclick="deleteType(${t.id})">删除\u003c/button\u003e
            \u003c/td\u003e
          \u003c/tr\u003e
        `).join('')}
      \u003c/tbody\u003e
    \u003c/table\u003e
  `;
  document.getElementById('types-list').innerHTML = html;
}

document.getElementById('create-type-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const type = {
    name: document.getElementById('new-type-name').value.trim(),
    storage_path: document.getElementById('new-type-path').value.trim(),
  };
  try {
    await api.admin.documentTypes.create(type);
    e.target.reset();
    await loadTypes();
    showMessage('文档类型添加成功', 'success');
  } catch (err) {
    showMessage(err.message);
  }
});

window.deleteType = async function (id) {
  if (!confirm('确定要删除该文档类型吗？')) return;
  try {
    await api.admin.documentTypes.delete(id);
    await loadTypes();
    showMessage('文档类型已删除', 'success');
  } catch (err) {
    showMessage(err.message);
  }
};

async function loadConfig() {
  const cfg = await api.admin.config.get();
  document.getElementById('onlyoffice-url').value = cfg.onlyoffice_server_url || '';
}

document.getElementById('config-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const cfg = {
    onlyoffice_server_url: document.getElementById('onlyoffice-url').value.trim(),
  };
  try {
    await api.admin.config.update(cfg);
    showMessage('配置保存成功', 'success');
  } catch (err) {
    showMessage(err.message);
  }
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  try {
    await api.auth.logout();
    location.href = '/login.html';
  } catch (err) {
    showMessage(err.message);
  }
});

init();
