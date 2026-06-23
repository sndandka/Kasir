/* ============================================================
   app.js — Main controller
   View routing, modal management, settings, user management,
   login/logout, offline indicator
   ============================================================ */

const App = (() => {

  /* ---------- View routing ---------- */
  function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById('view-' + viewId);
    if (target) target.classList.add('active');

    document.querySelectorAll('.nav-item').forEach(n => {
      n.classList.toggle('active', n.dataset.view === viewId);
    });

    // Trigger refresh for each view
    if (viewId === 'pos') POS.refresh();
    if (viewId === 'inventory') Inventory.render();
    if (viewId === 'reports') Reports.render();
    if (viewId === 'history') Reports.renderHistory();
    if (viewId === 'settings') loadSettings();
    if (viewId === 'users') renderUsers();
  }

  /* ---------- Modals ---------- */
  function openModal(id) {
    document.getElementById(id).classList.add('active');
  }

  function closeModal(id) {
    document.getElementById(id).classList.remove('active');
  }

  /* ---------- Settings ---------- */
  function loadSettings() {
    const s = DB.getSettings();
    document.getElementById('set-store-name').value = s.storeName || '';
    document.getElementById('set-store-address').value = s.storeAddress || '';
    document.getElementById('set-store-phone').value = s.storePhone || '';
    document.getElementById('set-receipt-footer').value = s.receiptFooter || '';
    document.getElementById('set-printer-size').value = s.printerSize || '58';
    document.getElementById('set-tax-enabled').checked = s.taxEnabled || false;
    document.getElementById('set-tax-percent').value = s.taxPercent || 0;
    document.getElementById('set-min-stock').value = s.minStockDefault || 5;
  }

  function saveSettings() {
    const settings = {
      storeName: document.getElementById('set-store-name').value.trim(),
      storeAddress: document.getElementById('set-store-address').value.trim(),
      storePhone: document.getElementById('set-store-phone').value.trim(),
      receiptFooter: document.getElementById('set-receipt-footer').value.trim(),
      printerSize: document.getElementById('set-printer-size').value,
      taxEnabled: document.getElementById('set-tax-enabled').checked,
      taxPercent: parseFloat(document.getElementById('set-tax-percent').value) || 0,
      minStockDefault: parseInt(document.getElementById('set-min-stock').value) || 5,
    };
    DB.saveSettings(settings);
    const msg = document.getElementById('settings-saved-msg');
    msg.textContent = '✓ Tersimpan';
    setTimeout(() => { msg.textContent = ''; }, 2000);
    showToast('Pengaturan disimpan', 'success');
  }

  /* ---------- User Management ---------- */
  function renderUsers() {
    const users = DB.getUsers();
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = '';

    users.forEach(u => {
      const tr = document.createElement('tr');
      const currentUser = Auth.currentUser();
      const isSelf = u.id === currentUser.id;
      tr.innerHTML = `
        <td><code>${escapeHtml(u.username)}</code></td>
        <td>${escapeHtml(u.fullname)}</td>
        <td><span class="badge ${u.role === 'admin' ? 'badge-ok' : ''}">${u.role === 'admin' ? 'Admin' : 'Kasir'}</span></td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" data-user-edit="${u.id}">✏️</button>
            ${!isSelf ? `<button class="icon-btn danger" data-user-delete="${u.id}">🗑</button>` : ''}
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('[data-user-edit]').forEach(btn => btn.addEventListener('click', () => openEditUserModal(btn.dataset.userEdit)));
    tbody.querySelectorAll('[data-user-delete]').forEach(btn => btn.addEventListener('click', () => deleteUser(btn.dataset.userDelete)));
  }

  function openAddUserModal() {
    document.getElementById('user-modal-title').textContent = 'Tambah User';
    document.getElementById('user-id-edit').value = '';
    document.getElementById('user-fullname').value = '';
    document.getElementById('user-username').value = '';
    document.getElementById('user-password').value = '';
    document.getElementById('user-role-select').value = 'kasir';
    openModal('modal-user');
    document.getElementById('user-fullname').focus();
  }

  function openEditUserModal(id) {
    const u = DB.getUsers().find(u => u.id === id);
    if (!u) return;
    document.getElementById('user-modal-title').textContent = 'Edit User';
    document.getElementById('user-id-edit').value = u.id;
    document.getElementById('user-fullname').value = u.fullname;
    document.getElementById('user-username').value = u.username;
    document.getElementById('user-password').value = '';
    document.getElementById('user-role-select').value = u.role;
    openModal('modal-user');
  }

  function saveUser() {
    const id = document.getElementById('user-id-edit').value;
    const fullname = document.getElementById('user-fullname').value.trim();
    const username = document.getElementById('user-username').value.trim();
    const password = document.getElementById('user-password').value;
    const role = document.getElementById('user-role-select').value;

    if (!fullname) return showToast('Nama lengkap wajib diisi', 'error');
    if (!username) return showToast('Username wajib diisi', 'error');
    if (!id && !password) return showToast('Password wajib diisi untuk user baru', 'error');

    const users = DB.getUsers();

    // Check username uniqueness
    const duplicate = users.find(u => u.username === username && u.id !== id);
    if (duplicate) return showToast('Username sudah digunakan', 'error');

    if (id) {
      const idx = users.findIndex(u => u.id === id);
      if (idx === -1) return;
      users[idx].fullname = fullname;
      users[idx].username = username;
      users[idx].role = role;
      if (password) users[idx].password = password;
    } else {
      users.push({ id: DB.uid('u_'), username, password, fullname, role });
    }

    DB.saveUsers(users);
    closeModal('modal-user');
    renderUsers();
    showToast(id ? 'User diperbarui' : 'User ditambahkan', 'success');
  }

  function deleteUser(id) {
    const u = DB.getUsers().find(u => u.id === id);
    if (!u) return;
    if (!confirm(`Hapus user "${u.fullname}"?`)) return;
    const users = DB.getUsers().filter(u => u.id !== id);
    DB.saveUsers(users);
    renderUsers();
    showToast('User dihapus', '');
  }

  /* ---------- Online/Offline indicator ---------- */
  function updateSyncStatus() {
    const dot = document.getElementById('sync-dot');
    const text = document.getElementById('sync-text');
    if (navigator.onLine) {
      dot.className = 'sync-dot online';
      text.textContent = 'Online';
    } else {
      dot.className = 'sync-dot offline';
      text.textContent = 'Offline (data lokal)';
    }
  }

  /* ---------- Bootstrap ---------- */
  function init() {
    DB.seed();

    const session = Auth.currentUser();

    if (session) {
      showApp(session);
    } else {
      showLogin();
    }

    // Login form
    document.getElementById('form-login').addEventListener('submit', e => {
      e.preventDefault();
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;
      const user = Auth.login(username, password);
      if (user) {
        document.getElementById('login-error').textContent = '';
        showApp(user);
      } else {
        document.getElementById('login-error').textContent = 'Username atau password salah.';
      }
    });

    // Logout
    document.getElementById('btn-logout').addEventListener('click', () => {
      if (confirm('Keluar dari aplikasi?')) {
        Auth.logout();
        showLogin();
      }
    });

    // Nav items
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        if (!Auth.isAdmin() && ['inventory', 'reports', 'settings', 'users'].includes(view)) {
          showToast('Akses ditolak', 'error');
          return;
        }
        showView(view);
      });
    });

    // Modal close buttons
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });

    // Close modal on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) closeModal(overlay.id);
      });
    });

    // Settings
    document.getElementById('btn-save-settings').addEventListener('click', saveSettings);

    // Users
    document.getElementById('btn-add-user').addEventListener('click', openAddUserModal);
    document.getElementById('btn-save-user').addEventListener('click', saveUser);

    // Online/Offline
    window.addEventListener('online', updateSyncStatus);
    window.addEventListener('offline', updateSyncStatus);
    updateSyncStatus();
  }

  function showLogin() {
    document.getElementById('page-login').classList.add('active');
    document.getElementById('page-app').classList.remove('active');
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('login-error').textContent = '';
  }

  function showApp(user) {
    document.getElementById('page-login').classList.remove('active');
    document.getElementById('page-app').classList.add('active');
    Auth.applyRoleVisibility();

    // Init modules
    POS.init();
    Inventory.init();
    Reports.init();

    showView('pos');
  }

  return { init, openModal, closeModal, showView };
})();

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
