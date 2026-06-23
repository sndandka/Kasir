/* ============================================================
   db.js — Local "database" layer using localStorage
   Mensimulasikan penyimpanan offline-first dengan sinkronisasi.
   ============================================================ */

const DB = (() => {
  const KEYS = {
    USERS: 'pos_users',
    PRODUCTS: 'pos_products',
    SALES: 'pos_sales',
    STOCK_LOG: 'pos_stock_log',
    SETTINGS: 'pos_settings',
    SESSION: 'pos_session',
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function uid(prefix = '') {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ---------- Seed default data on first run ---------- */
  function seed() {
    if (!localStorage.getItem(KEYS.USERS)) {
      write(KEYS.USERS, [
        { id: uid('u_'), username: 'admin', password: 'admin123', fullname: 'Admin Toko', role: 'admin' },
        { id: uid('u_'), username: 'kasir', password: 'kasir123', fullname: 'Kasir 1', role: 'kasir' },
      ]);
    }

    if (!localStorage.getItem(KEYS.SETTINGS)) {
      write(KEYS.SETTINGS, {
        storeName: 'Toko Aksesoris Hp Jaya',
        storeAddress: 'Jl. Mawar No. 10, Surabaya',
        storePhone: '0812-3456-7890',
        receiptFooter: 'Barang yang sudah dibeli tidak dapat ditukar. Terima kasih!',
        printerSize: '58',
        taxEnabled: false,
        taxPercent: 0,
        minStockDefault: 5,
      });
    }

    if (!localStorage.getItem(KEYS.PRODUCTS)) {
      const sample = [
        { name: 'Casing Silicone Candy - Merah', category: 'Casing', brand: 'Generic', compatible: ['iPhone 13', 'iPhone 13 Pro'], variant: 'Merah', cost: 15000, price: 35000, stock: 20, minStock: 5 },
        { name: 'Casing Silicone Candy - Biru', category: 'Casing', brand: 'Generic', compatible: ['iPhone 13', 'iPhone 13 Pro'], variant: 'Biru', cost: 15000, price: 35000, stock: 18, minStock: 5 },
        { name: 'Casing iPhone 13 Pro Max - Hitam', category: 'Casing', brand: 'Generic', compatible: ['iPhone 13 Pro Max'], variant: 'Hitam', cost: 20000, price: 45000, stock: 4, minStock: 5 },
        { name: 'Casing Samsung A54 - Transparan', category: 'Casing', brand: 'Generic', compatible: ['Samsung A54'], variant: 'Transparan', cost: 12000, price: 30000, stock: 25, minStock: 5 },
        { name: 'Tempered Glass iPhone 11', category: 'Tempered Glass', brand: 'Generic', compatible: ['iPhone 11'], variant: '', cost: 8000, price: 25000, stock: 30, minStock: 8 },
        { name: 'Tempered Glass iPhone 13 / 13 Pro', category: 'Tempered Glass', brand: 'Generic', compatible: ['iPhone 13', 'iPhone 13 Pro'], variant: '', cost: 9000, price: 25000, stock: 2, minStock: 8 },
        { name: 'Tempered Glass Samsung A54', category: 'Tempered Glass', brand: 'Generic', compatible: ['Samsung A54'], variant: '', cost: 8000, price: 22000, stock: 15, minStock: 8 },
        { name: 'Charger Fast Charging 20W', category: 'Charger', brand: 'Anker', compatible: ['Universal'], variant: '', cost: 65000, price: 120000, stock: 10, minStock: 3 },
        { name: 'Charger Kepala 2A', category: 'Charger', brand: 'Generic', compatible: ['Universal'], variant: '', cost: 18000, price: 35000, stock: 0, minStock: 5 },
        { name: 'Kabel Data USB-C', category: 'Kabel Data', brand: 'Generic', compatible: ['Universal'], variant: '', cost: 12000, price: 25000, stock: 40, minStock: 10 },
        { name: 'Kabel Data Lightning', category: 'Kabel Data', brand: 'Generic', compatible: ['iPhone'], variant: '', cost: 15000, price: 30000, stock: 22, minStock: 10 },
        { name: 'Earphone Kabel 3.5mm', category: 'Audio', brand: 'Generic', compatible: ['Universal'], variant: '', cost: 10000, price: 22000, stock: 14, minStock: 5 },
        { name: 'TWS Bluetooth Earbuds', category: 'Audio', brand: 'Generic', compatible: ['Universal'], variant: '', cost: 45000, price: 95000, stock: 6, minStock: 3 },
        { name: 'Gantungan Kunci Karakter Lucu', category: 'Gantungan Kunci', brand: 'Generic', compatible: ['Universal'], variant: 'Random', cost: 3000, price: 10000, stock: 50, minStock: 10 },
        { name: 'Popsocket Polos', category: 'Lainnya', brand: 'Generic', compatible: ['Universal'], variant: '', cost: 5000, price: 15000, stock: 12, minStock: 5 },
      ];
      write(KEYS.PRODUCTS, sample.map(p => ({ id: uid('p_'), ...p, createdAt: Date.now() })));
    }

    if (!localStorage.getItem(KEYS.SALES)) write(KEYS.SALES, []);
    if (!localStorage.getItem(KEYS.STOCK_LOG)) write(KEYS.STOCK_LOG, []);
  }

  /* ---------- Public accessors ---------- */
  return {
    KEYS, uid, seed,

    getUsers: () => read(KEYS.USERS, []),
    saveUsers: (users) => write(KEYS.USERS, users),

    getProducts: () => read(KEYS.PRODUCTS, []),
    saveProducts: (products) => write(KEYS.PRODUCTS, products),

    getSales: () => read(KEYS.SALES, []),
    saveSales: (sales) => write(KEYS.SALES, sales),

    getStockLog: () => read(KEYS.STOCK_LOG, []),
    saveStockLog: (log) => write(KEYS.STOCK_LOG, log),

    getSettings: () => read(KEYS.SETTINGS, {}),
    saveSettings: (settings) => write(KEYS.SETTINGS, settings),

    getSession: () => read(KEYS.SESSION, null),
    saveSession: (session) => write(KEYS.SESSION, session),
    clearSession: () => localStorage.removeItem(KEYS.SESSION),
  };
})();

/* ---------- Formatting helpers ---------- */
function formatRupiah(num) {
  num = Math.round(num || 0);
  return 'Rp ' + num.toLocaleString('id-ID');
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast show ' + type;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.className = 'toast'; }, 2500);
}
