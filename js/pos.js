/* ============================================================
   pos.js — Antarmuka Transaksi Kasir (POS)
   Pencarian produk, keranjang, diskon, kalkulasi, pembayaran
   ============================================================ */

const POS = (() => {
  let cart = []; // { productId, name, price, qty, discountType, discountValue }
  let activeCategory = 'Semua';
  let currentPaymentMethod = 'Tunai';
  let lastTransaction = null;

  /* ---------- Rendering products ---------- */
  function getCategories() {
    const products = DB.getProducts();
    const cats = new Set(products.map(p => p.category));
    return ['Semua', ...Array.from(cats).sort()];
  }

  function renderCategoryTabs() {
    const wrap = document.getElementById('category-tabs');
    wrap.innerHTML = '';
    getCategories().forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'category-tab' + (cat === activeCategory ? ' active' : '');
      btn.textContent = cat;
      btn.addEventListener('click', () => {
        activeCategory = cat;
        renderCategoryTabs();
        renderProductGrid();
      });
      wrap.appendChild(btn);
    });
  }

  function matchesSearch(product, query) {
    if (!query) return true;
    query = query.toLowerCase();
    const haystack = [
      product.name,
      product.category,
      product.brand,
      product.variant,
      ...(product.compatible || []),
    ].join(' ').toLowerCase();
    return haystack.includes(query);
  }

  function renderProductGrid() {
    const grid = document.getElementById('product-grid');
    const query = document.getElementById('pos-search').value.trim();
    const products = DB.getProducts()
      .filter(p => activeCategory === 'Semua' || p.category === activeCategory)
      .filter(p => matchesSearch(p, query));

    grid.innerHTML = '';
    if (products.length === 0) {
      grid.innerHTML = '<div class="empty-state">Produk tidak ditemukan</div>';
      return;
    }

    products.forEach(p => {
      const card = document.createElement('div');
      card.className = 'product-card' + (p.stock <= 0 ? ' out-of-stock' : '');

      let stockClass = '';
      if (p.stock <= 0) stockClass = 'zero';
      else if (p.stock <= (p.minStock || 5)) stockClass = 'low';

      card.innerHTML = `
        <div class="pc-name">${escapeHtml(p.name)}</div>
        <div class="pc-cat">${escapeHtml(p.category)}${p.variant ? ' · ' + escapeHtml(p.variant) : ''}</div>
        <div class="pc-price">${formatRupiah(p.price)}</div>
        <div class="pc-stock ${stockClass}">Stok: ${p.stock}</div>
      `;
      card.addEventListener('click', () => {
        if (p.stock <= 0) {
          showToast('Stok produk ini habis', 'error');
          return;
        }
        addToCart(p);
      });
      grid.appendChild(card);
    });
  }

  /* ---------- Cart logic ---------- */
  function addToCart(product) {
    const existing = cart.find(c => c.productId === product.id);
    const currentStock = DB.getProducts().find(p => p.id === product.id).stock;

    if (existing) {
      if (existing.qty + 1 > currentStock) {
        showToast('Stok tidak cukup', 'error');
        return;
      }
      existing.qty += 1;
    } else {
      cart.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        cost: product.cost,
        qty: 1,
        discountType: 'amount',
        discountValue: 0,
      });
    }
    renderCart();
  }

  function changeQty(productId, delta) {
    const item = cart.find(c => c.productId === productId);
    if (!item) return;
    const product = DB.getProducts().find(p => p.id === productId);
    const newQty = item.qty + delta;

    if (newQty <= 0) {
      cart = cart.filter(c => c.productId !== productId);
    } else if (newQty > product.stock) {
      showToast('Stok tidak cukup', 'error');
      return;
    } else {
      item.qty = newQty;
    }
    renderCart();
  }

  function removeFromCart(productId) {
    cart = cart.filter(c => c.productId !== productId);
    renderCart();
  }

  function setItemDiscount(productId, type, value) {
    const item = cart.find(c => c.productId === productId);
    if (!item) return;
    item.discountType = type;
    item.discountValue = Math.max(0, Number(value) || 0);
    renderCart();
  }

  function clearCart() {
    cart = [];
    renderCart();
  }

  function itemLineTotal(item) {
    const base = item.price * item.qty;
    let discount = 0;
    if (item.discountType === 'percent') {
      discount = base * (item.discountValue / 100);
    } else {
      discount = item.discountValue;
    }
    discount = Math.min(discount, base);
    return Math.max(0, base - discount);
  }

  function getSubtotal() {
    return cart.reduce((sum, item) => sum + itemLineTotal(item), 0);
  }

  function getCartDiscount(subtotal) {
    const value = Number(document.getElementById('cart-discount-value').value) || 0;
    const type = document.getElementById('cart-discount-type').value;
    let discount = type === 'percent' ? subtotal * (value / 100) : value;
    return Math.min(Math.max(0, discount), subtotal);
  }

  function getTax(amountAfterDiscount) {
    const settings = DB.getSettings();
    if (!settings.taxEnabled) return 0;
    return amountAfterDiscount * ((settings.taxPercent || 0) / 100);
  }

  function getTotals() {
    const subtotal = getSubtotal();
    const cartDiscount = getCartDiscount(subtotal);
    const afterDiscount = subtotal - cartDiscount;
    const tax = getTax(afterDiscount);
    const total = afterDiscount + tax;
    return { subtotal, cartDiscount, tax, total };
  }

  function renderCart() {
    const wrap = document.getElementById('cart-items');
    wrap.innerHTML = '';

    if (cart.length === 0) {
      wrap.innerHTML = '<div class="empty-state">Keranjang masih kosong</div>';
    } else {
      cart.forEach(item => {
        const lineTotal = itemLineTotal(item);
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
          <div class="ci-info">
            <div class="ci-name">${escapeHtml(item.name)}</div>
            <div class="ci-price">${formatRupiah(item.price)} / pcs</div>
            <div class="ci-discount">
              <label>Diskon</label>
              <input type="number" min="0" value="${item.discountValue}" data-id="${item.productId}" class="ci-discount-input">
              <select data-id="${item.productId}" class="ci-discount-type">
                <option value="amount" ${item.discountType === 'amount' ? 'selected' : ''}>Rp</option>
                <option value="percent" ${item.discountType === 'percent' ? 'selected' : ''}>%</option>
              </select>
            </div>
          </div>
          <div class="ci-qty-group">
            <button class="ci-qty-btn ci-minus" data-id="${item.productId}">−</button>
            <span class="ci-qty-val">${item.qty}</span>
            <button class="ci-qty-btn ci-plus" data-id="${item.productId}">+</button>
          </div>
          <div class="ci-subtotal">${formatRupiah(lineTotal)}</div>
          <button class="ci-remove" data-id="${item.productId}" title="Hapus">🗑</button>
        `;
        wrap.appendChild(div);
      });

      // Bind events
      wrap.querySelectorAll('.ci-minus').forEach(b => b.addEventListener('click', () => changeQty(b.dataset.id, -1)));
      wrap.querySelectorAll('.ci-plus').forEach(b => b.addEventListener('click', () => changeQty(b.dataset.id, 1)));
      wrap.querySelectorAll('.ci-remove').forEach(b => b.addEventListener('click', () => removeFromCart(b.dataset.id)));
      wrap.querySelectorAll('.ci-discount-input').forEach(inp => inp.addEventListener('input', () => {
        const item = cart.find(c => c.productId === inp.dataset.id);
        setItemDiscount(inp.dataset.id, item.discountType, inp.value);
      }));
      wrap.querySelectorAll('.ci-discount-type').forEach(sel => sel.addEventListener('change', () => {
        const item = cart.find(c => c.productId === sel.dataset.id);
        setItemDiscount(sel.dataset.id, sel.value, item.discountValue);
      }));
    }

    renderSummary();
  }

  function renderSummary() {
    const { subtotal, cartDiscount, total } = getTotals();
    document.getElementById('sum-subtotal').textContent = formatRupiah(subtotal);
    document.getElementById('sum-discount').textContent = '- ' + formatRupiah(cartDiscount);
    document.getElementById('sum-total').textContent = formatRupiah(total);
  }

  /* ---------- Payment ---------- */
  function openPaymentModal() {
    if (cart.length === 0) {
      showToast('Keranjang masih kosong', 'error');
      return;
    }
    const { total } = getTotals();
    document.getElementById('pay-total').textContent = formatRupiah(total);
    document.getElementById('pay-received').value = '';
    document.getElementById('pay-change').textContent = formatRupiah(0);
    document.getElementById('pay-change').classList.remove('negative');
    currentPaymentMethod = 'Tunai';

    document.querySelectorAll('.pay-method-btn').forEach(b => b.classList.toggle('active', b.dataset.method === 'Tunai'));
    document.getElementById('cash-input-group').style.display = 'block';

    renderQuickCash(total);
    App.openModal('modal-payment');
    setTimeout(() => document.getElementById('pay-received').focus(), 100);
  }

  function renderQuickCash(total) {
    const wrap = document.getElementById('quick-cash');
    wrap.innerHTML = '';
    const rounded = Math.ceil(total / 1000) * 1000;
    const options = new Set([rounded, rounded + 5000, rounded + 10000, rounded + 50000, Math.ceil(total / 50000) * 50000 || 50000]);
    Array.from(options).sort((a, b) => a - b).slice(0, 4).forEach(val => {
      const btn = document.createElement('button');
      btn.textContent = formatRupiah(val);
      btn.addEventListener('click', () => {
        document.getElementById('pay-received').value = val;
        updateChange();
      });
      wrap.appendChild(btn);
    });
    const exactBtn = document.createElement('button');
    exactBtn.textContent = 'Pas (' + formatRupiah(total) + ')';
    exactBtn.addEventListener('click', () => {
      document.getElementById('pay-received').value = Math.round(total);
      updateChange();
    });
    wrap.prepend(exactBtn);
  }

  function updateChange() {
    const { total } = getTotals();
    const received = Number(document.getElementById('pay-received').value) || 0;
    const change = received - total;
    const el = document.getElementById('pay-change');
    el.textContent = formatRupiah(change);
    el.classList.toggle('negative', change < 0);
  }

  function selectPaymentMethod(method) {
    currentPaymentMethod = method;
    document.querySelectorAll('.pay-method-btn').forEach(b => b.classList.toggle('active', b.dataset.method === method));
    document.getElementById('cash-input-group').style.display = method === 'Tunai' ? 'block' : 'none';
  }

  function confirmPayment() {
    const { subtotal, cartDiscount, tax, total } = getTotals();
    let received = total;
    let change = 0;

    if (currentPaymentMethod === 'Tunai') {
      received = Number(document.getElementById('pay-received').value) || 0;
      if (received < total) {
        showToast('Uang diterima kurang dari total', 'error');
        return;
      }
      change = received - total;
    }

    const session = Auth.currentUser();
    const products = DB.getProducts();
    const sales = DB.getSales();
    const stockLog = DB.getStockLog();
    const settings = DB.getSettings();

    const receiptNo = 'TRX-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + (sales.length + 1).toString().padStart(4, '0');

    const items = cart.map(item => {
      const product = products.find(p => p.id === item.productId);
      product.stock -= item.qty;

      stockLog.push({
        id: DB.uid('log_'),
        productId: item.productId,
        productName: item.name,
        type: 'sale',
        change: -item.qty,
        note: 'Penjualan ' + receiptNo,
        timestamp: Date.now(),
      });

      return {
        productId: item.productId,
        name: item.name,
        price: item.price,
        cost: item.cost,
        qty: item.qty,
        discountType: item.discountType,
        discountValue: item.discountValue,
        lineTotal: itemLineTotal(item),
      };
    });

    const transaction = {
      id: DB.uid('s_'),
      receiptNo,
      timestamp: Date.now(),
      cashierId: session.id,
      cashierName: session.fullname,
      items,
      subtotal,
      discount: cartDiscount,
      tax,
      total,
      paymentMethod: currentPaymentMethod,
      received,
      change,
    };

    sales.push(transaction);
    DB.saveSales(sales);
    DB.saveProducts(products);
    DB.saveStockLog(stockLog);

    lastTransaction = transaction;

    App.closeModal('modal-payment');
    clearCart();
    document.getElementById('cart-discount-value').value = 0;
    renderProductGrid();

    showToast('Transaksi berhasil! ' + receiptNo, 'success');
    Receipt.show(transaction, settings);
  }

  /* ---------- Init / bindings ---------- */
  function init() {
    renderCategoryTabs();
    renderProductGrid();
    renderCart();

    document.getElementById('pos-search').addEventListener('input', renderProductGrid);

    document.getElementById('btn-clear-cart').addEventListener('click', () => {
      if (cart.length === 0) return;
      if (confirm('Kosongkan keranjang?')) clearCart();
    });

    document.getElementById('cart-discount-value').addEventListener('input', renderSummary);
    document.getElementById('cart-discount-type').addEventListener('change', renderSummary);

    document.getElementById('btn-checkout').addEventListener('click', openPaymentModal);

    document.querySelectorAll('.pay-method-btn').forEach(btn => {
      btn.addEventListener('click', () => selectPaymentMethod(btn.dataset.method));
    });

    document.getElementById('pay-received').addEventListener('input', updateChange);
    document.getElementById('btn-confirm-payment').addEventListener('click', confirmPayment);
  }

  function refresh() {
    renderCategoryTabs();
    renderProductGrid();
    renderCart();
  }

  return { init, refresh, getTotals };
})();

/* ---------- Utility ---------- */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
