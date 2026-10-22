let currentUser = null;
let currentDocId = null;
let currentUsers = [];
let docs = [];
let filterType = 'all';

// 允许上传的文件后缀 → 文档类型（与后端 EXT_TO_TYPE_NAME 保持一致）
const ALLOWED_EXT = { doc: 'word', docx: 'word', xls: 'excel', xlsx: 'excel', ppt: 'ppt', pptx: 'ppt', pdf: 'pdf' };

const messageEl = document.getElementById('message');
const currentUserEl = document.getElementById('current-user');
const userAvatarEl = document.getElementById('user-avatar');
const adminLinkEl = document.getElementById('admin-link');
const docListEl = document.getElementById('doc-list');
const mainTitleEl = document.getElementById('main-title');
const uploadFileEl = document.getElementById('upload-file');
const btnUploadEl = document.getElementById('btn-upload');
const btnRefreshEl = document.getElementById('btn-refresh');
const editorCard = document.getElementById('editor-card');
const editorTitleEl = document.getElementById('editor-title');
const editorEl = document.getElementById('editor');
const permissionModal = document.getElementById('permission-modal');
const permUserEl = document.getElementById('perm-user');
const permLevelEl = document.getElementById('perm-level');

function showMessage(text, type = 'error') {
  messageEl.innerHTML = `<div class="message ${type}">${text}</div>`;
  setTimeout(() => { messageEl.innerHTML = ''; }, 5000);
}

function formatDate(str) {
  if (!str) return '-';
  const d = new Date(str);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function badgeClass(level) {
  if (level === 'admin') return 'badge-admin';
  if (level === 'edit') return 'badge-edit';
  return 'badge-view';
}

function badgeText(level) {
  if (level === 'admin') return '管理';
  if (level === 'edit') return '编辑';
  return '查看';
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getExt(name) {
  const m = String(name || '').match(/\.([^.]+)$/);
  return m ? m[1].toLowerCase() : '';
}

const TYPE_META = {
  word: { icon: 'W', label: 'Word' },
  excel: { icon: 'X', label: 'Excel' },
  ppt: { icon: 'P', label: 'PPT' },
  pdf: { icon: 'PDF', label: 'PDF' },
};

function fileIcon(typeName) {
  const m = TYPE_META[typeName] || { icon: 'F' };
  return `<span class="file-icon ${typeName || 'doc'}">${m.icon}</span>`;
}

function loadOnlyOfficeScript(serverUrl) {
  return new Promise((resolve, reject) => {
    if (window.DocsAPI && window.DocsAPI.DocEditor) {
      return resolve();
    }
    const url = `${serverUrl}/web-apps/apps/api/documents/api.js`;
    const existing = document.querySelector(`script[src="${url}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('OnlyOffice 脚本加载失败')));
      if (window.DocsAPI && window.DocsAPI.DocEditor) {
        return resolve();
      }
      return;
    }
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('OnlyOffice 脚本加载失败'));
    document.head.appendChild(script);
  });
}

async function init() {
  try {
    currentUser = await api.auth.me();
    const displayName = currentUser.nickname || currentUser.username;
    currentUserEl.textContent = displayName;
    if (userAvatarEl) {
      userAvatarEl.textContent = (displayName || '?').slice(0, 1).toUpperCase();
    }
    if (currentUser.role === 'admin') {
      adminLinkEl.style.display = '';
    }
    bindSidebarNav();
    await loadDocuments();
  } catch (err) {
    showMessage(err.message);
  }
}

function bindSidebarNav() {
  document.querySelectorAll('.sidebar-nav .nav-item').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.sidebar-nav .nav-item').forEach((n) => n.classList.remove('active'));
      el.classList.add('active');
      filterType = el.dataset.type || 'all';
      if (mainTitleEl) {
        const labelMap = { all: '我的文档', word: 'Word 文档', excel: 'Excel 文档', ppt: 'PPT 文档', pdf: 'PDF 文档' };
        mainTitleEl.textContent = labelMap[filterType] || '我的文档';
      }
      renderDocuments();
    });
  });
}

async function loadDocuments() {
  docs = await api.documents.list();
  renderDocuments();
}

function renderDocuments() {
  const list = filterType === 'all' ? docs : docs.filter((d) => d.type_name === filterType);
  if (list.length === 0) {
    docListEl.innerHTML = '<div class="empty-state">暂无文档，请上传</div>';
    return;
  }

  const html = `
    <table class="doc-list">
      <thead>
        <tr>
          <th>名称</th>
          <th>类型</th>
          <th>所有者</th>
          <th>更新时间</th>
          <th class="col-actions">操作</th>
        </tr>
      </thead>
      <tbody>
        ${list.map((doc) => `
          <tr>
            <td>
              <div class="doc-name-cell">
                ${fileIcon(doc.type_name)}
                <a class="doc-name" onclick="openEditor(${doc.id})">${escapeHtml(doc.title)}</a>
              </div>
            </td>
            <td>${(TYPE_META[doc.type_name] && TYPE_META[doc.type_name].label) || doc.type_name || '-'}</td>
            <td>${escapeHtml(doc.owner_name || '-')}</td>
            <td>${formatDate(doc.updated_at)}</td>
            <td class="col-actions">
              ${doc.permission === 'admin'
                ? `<button class="icon-btn" title="权限管理" onclick="openPermissionModal(${doc.id})">&#9881;</button><button class="icon-btn danger" title="删除" onclick="deleteDocument(${doc.id})">&#128465;</button>`
                : '<span class="muted">-</span>'}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  docListEl.innerHTML = html;
}

function resizeEditor() {
  if (!editorEl) return;
  const iframe = editorEl.querySelector('iframe');
  if (iframe) {
    const rect = editorEl.getBoundingClientRect();
    iframe.style.height = `${rect.height}px`;
    iframe.style.width = '100%';
  }
  if (window.editorInstance && typeof window.editorInstance.resize === 'function') {
    window.editorInstance.resize();
  }
}

window.openEditor = async function (docId) {
  try {
    currentDocId = docId;

    // 先销毁已有实例：OnlyOffice 禁止在同一容器上重复初始化，否则容器状态会损坏
    if (window.editorInstance && typeof window.editorInstance.destroyEditor === 'function') {
      try { window.editorInstance.destroyEditor(); } catch (e) { console.warn('[openEditor] destroy 旧实例失败:', e); }
      window.editorInstance = null;
    }

    const cfg = await api.documents.config(docId);
    await loadOnlyOfficeScript(cfg.serverUrl);
    console.log('[openEditor] DocsAPI 就绪:', typeof window.DocsAPI, '| DocEditor:', typeof (window.DocsAPI && window.DocsAPI.DocEditor));

    editorCard.style.display = 'block';
    editorCard.classList.add('fullscreen');
    editorTitleEl.textContent = cfg.document.title;

    // 重新获取容器，避免使用脱离 DOM 的旧引用
    const container = document.getElementById('editor');
    if (!container) {
      throw new Error('找不到 #editor 容器，无法初始化编辑器');
    }
    container.innerHTML = '';

    // 等浏览器完成重排后再初始化 OnlyOffice，确保它能读到正确容器尺寸
    await new Promise(resolve => requestAnimationFrame(resolve));
    await new Promise(resolve => setTimeout(resolve, 50));

    const rect = container.getBoundingClientRect();
    // 容器尺寸异常时兜底，防止 DocEditor 以 0 高度初始化后放弃渲染
    const editorHeight = rect.height > 100 ? rect.height : (window.innerHeight - 48);
    console.log('[openEditor] 容器尺寸:', Math.round(rect.width), 'x', Math.round(rect.height), '-> editorHeight=', editorHeight);

    window.editorInstance = new DocsAPI.DocEditor('editor', {
      documentType: cfg.documentType,
      token: cfg.token,
      document: {
        fileType: cfg.document.fileType,
        key: cfg.document.key,
        url: cfg.document.url,
        title: cfg.document.title,
        token: cfg.document.token,
      },
      editorConfig: {
        mode: cfg.editorConfig.mode,
        callbackUrl: cfg.editorConfig.callbackUrl,
        user: cfg.editorConfig.user,
        lang: cfg.editorConfig.lang,
        token: cfg.editorConfig.token,
      },
      height: `${editorHeight}px`,
      width: '100%',
      events: {
        onError: (e) => console.error('[OnlyOffice onError]', e),
        onWarning: (e) => console.warn('[OnlyOffice onWarning]', e),
        onDocumentReady: () => console.log('[OnlyOffice] onDocumentReady 文档就绪'),
      },
    });
    console.log('[openEditor] DocEditor 创建完成, editorInstance=', !!window.editorInstance);

    window.removeEventListener('resize', resizeEditor);
    window.addEventListener('resize', resizeEditor);
    editorCard.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    console.error('[openEditor] 初始化失败:', err);
    showMessage(err.message);
  }
};

window.deleteDocument = async function (docId) {
  if (!confirm('确定要删除该文档吗？')) return;
  try {
    await api.documents.delete(docId);
    if (currentDocId === docId) {
      closeEditor();
    }
    await loadDocuments();
    showMessage('文档已删除', 'success');
  } catch (err) {
    showMessage(err.message);
  }
};

function closeEditor() {
  window.removeEventListener('resize', resizeEditor);
  if (window.editorInstance && typeof window.editorInstance.destroyEditor === 'function') {
    window.editorInstance.destroyEditor();
  }
  editorCard.style.display = 'none';
  editorCard.classList.remove('fullscreen');
  editorEl.innerHTML = '';
  window.editorInstance = null;
  currentDocId = null;
}

document.getElementById('btn-close-editor').addEventListener('click', closeEditor);

btnUploadEl.addEventListener('click', () => uploadFileEl.click());

uploadFileEl.addEventListener('change', async () => {
  const file = uploadFileEl.files[0];
  if (!file) return;

  const ext = getExt(file.name);
  if (!ALLOWED_EXT[ext]) {
    showMessage('仅支持 Word(doc/docx)、Excel(xls/xlsx)、PPT(ppt/pptx)、PDF(pdf) 文件');
    uploadFileEl.value = '';
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  try {
    await api.documents.create(formData);
    uploadFileEl.value = '';
    await loadDocuments();
    showMessage('上传成功', 'success');
  } catch (err) {
    showMessage(err.message);
  }
});

btnRefreshEl.addEventListener('click', async () => {
  btnRefreshEl.classList.add('loading');
  btnRefreshEl.disabled = true;
  try {
    await loadDocuments();
  } catch (err) {
    showMessage(err.message);
  } finally {
    btnRefreshEl.classList.remove('loading');
    btnRefreshEl.disabled = false;
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

window.openPermissionModal = async function (docId) {
  currentDocId = docId;
  permissionModal.style.display = 'flex';
  await loadPermissionUsers();
  await renderPermissions();
};

async function loadPermissionUsers() {
  currentUsers = await api.admin.users.list();
  const doc = docs.find((d) => d.id === currentDocId);
  const options = currentUsers
    .filter((u) => u.id !== currentUser.id && u.id !== doc.owner_id)
    .map((u) => `<option value="${u.id}">${u.nickname || u.username}</option>`)
    .join('');
  permUserEl.innerHTML = options || '<option>无可用用户</option>';
}

async function renderPermissions() {
  const rows = await api.documents.permissions(currentDocId);
  const tbody = document.getElementById('permission-table');
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#999;">暂无共享权限</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map((row) => `
    <tr>
      <td>${row.nickname || row.username}</td>
      <td><span class="badge ${badgeClass(row.level)}">${badgeText(row.level)}</span></td>
      <td><button class="danger" onclick="removePermission(${row.user_id})">移除</button></td>
    </tr>
  `).join('');
}

window.removePermission = async function (userId) {
  try {
    await api.documents.setPermission(currentDocId, userId, null);
    await renderPermissions();
  } catch (err) {
    showMessage(err.message);
  }
};

document.getElementById('btn-add-perm').addEventListener('click', async () => {
  const userId = parseInt(permUserEl.value, 10);
  const level = permLevelEl.value;
  if (!userId) return;
  try {
    await api.documents.setPermission(currentDocId, userId, level);
    await renderPermissions();
  } catch (err) {
    showMessage(err.message);
  }
});

document.getElementById('btn-close-perm').addEventListener('click', () => {
  permissionModal.style.display = 'none';
  currentDocId = null;
});

init();
