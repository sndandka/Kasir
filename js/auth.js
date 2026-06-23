/* ============================================================
   auth.js — Login, session, role-based UI
   ============================================================ */

const Auth = (() => {

  function login(username, password) {
    const users = DB.getUsers();
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) return null;
    DB.saveSession({ id: user.id, username: user.username, fullname: user.fullname, role: user.role, loginAt: Date.now() });
    return user;
  }

  function logout() {
    DB.clearSession();
  }

  function currentUser() {
    return DB.getSession();
  }

  function isAdmin() {
    const s = currentUser();
    return s && s.role === 'admin';
  }

  function applyRoleVisibility() {
    const session = currentUser();
    if (!session) return;

    document.querySelectorAll('.admin-only').forEach(el => {
      el.classList.toggle('hidden', session.role !== 'admin');
    });

    document.getElementById('user-name').textContent = session.fullname;
    document.getElementById('user-role').textContent = session.role === 'admin' ? 'Admin' : 'Kasir';
    document.getElementById('user-avatar').textContent = session.fullname.charAt(0).toUpperCase();
  }

  return { login, logout, currentUser, isAdmin, applyRoleVisibility };
})();
