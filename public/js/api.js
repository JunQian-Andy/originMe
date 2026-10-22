const API_BASE = '';

async function request(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (res.status === 401) {
    if (!location.pathname.endsWith('/login.html')) {
      location.href = '/login.html';
    }
    throw new Error('请先登录');
  }

  const data = await res.json().catch(() => ({ success: false, message: '响应解析失败' }));
  if (!res.ok || !data.success) {
    throw new Error(data.message || `请求失败: ${res.status}`);
  }
  return data.data;
}

const api = {
  auth: {
    login: (username, password) => request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
    demoLogin: (nickname) => request('/api/auth/demo-login', {
      method: 'POST',
      body: JSON.stringify({ nickname }),
    }),
    logout: () => request('/api/auth/logout', { method: 'POST' }),
    me: () => request('/api/auth/me'),
    changePassword: (oldPassword, newPassword) => request('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
    }),
  },
  documents: {
    list: () => request('/api/documents'),
    get: (id) => request(`/api/documents/${id}`),
    create: (formData) => fetch('/api/documents', {
      method: 'POST',
      credentials: 'same-origin',
      body: formData,
    }).then(async (res) => {
      const data = await res.json().catch(() => ({ success: false, message: '响应解析失败' }));
      if (!res.ok || !data.success) throw new Error(data.message || `请求失败: ${res.status}`);
      return data.data;
    }),
    delete: (id) => request(`/api/documents/${id}`, { method: 'DELETE' }),
    config: (id) => request(`/api/documents/${id}/config`),
    permissions: (id) => request(`/api/documents/${id}/permissions`),
    setPermission: (id, userId, level) => request(`/api/documents/${id}/permissions`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, level }),
    }),
  },
  admin: {
    users: {
      list: () => request('/api/admin/users'),
      create: (user) => request('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(user),
      }),
      update: (id, user) => request(`/api/admin/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(user),
      }),
      resetPassword: (id, newPassword) => request(`/api/admin/users/${id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
      }),
    },
    documentTypes: {
      list: () => request('/api/admin/document-types'),
      create: (type) => request('/api/admin/document-types', {
        method: 'POST',
        body: JSON.stringify(type),
      }),
      update: (id, type) => request(`/api/admin/document-types/${id}`, {
        method: 'PUT',
        body: JSON.stringify(type),
      }),
      delete: (id) => request(`/api/admin/document-types/${id}`, { method: 'DELETE' }),
    },
    config: {
      get: () => request('/api/admin/config'),
      update: (cfg) => request('/api/admin/config', {
        method: 'PUT',
        body: JSON.stringify(cfg),
      }),
    },
  },
};
