/* ============================================================
   inventory.js — Manajemen Inventaris (Admin Only)
   CRUD produk, update stok, low-stock alerts
   ============================================================ */

const Inventory = (() => {
  let editingId = null;

  /* ---------- Render Table ---------- */
  function render() {
    const query = document.getElementById('inv-search').value.toLowerCase();
    const products = DB.getProducts().filter(p => {
      const hay = [p.name, p.category, p.brand, ...(p.compatible || [])].join(' ').toLowerCase();
      return hay.includes(query);
    });

    const tbody = document.getElementById('inventory-tbody');
    tbody.innerHTML = '';

    if (products.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:30px">Tidak ada produk ditemukan</td></tr>';
      return;
    }

    products.forEach(p => {
      let stockBadge = '';
      if (p.stock <= 0)
        stockBadge = `<span class="badge badge-out">Habis</span>`;
      else if (p.stock <= (p.minStock || 5))
        stockBadge = `<span class="badge badge-low">Menipis</span>`;
      else
        stockBadge = `<span class="badge badge-ok">OK</span>`;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(p.name)}</strong>${p.variant ? '<br><small style="color:var(--text-muted)">' + escapeHtml(p.variant) + '</small>' : ''}</td>
        <td>${escapeHtml(p.category)}</td>
        <td>${escapeHtml(p.brand || '-')}</td>
        <td style="max-width:150px;font-size:12px">${(p.compatible || []).join(', ') || '-'}</td>
        <td>${formatRupiah(p.cost)}</td>
        <td>${formatRupiah(p.price)}</td>
        <td>${p.stock} ${stockBadge}</td>
        <td>${p.minStock || 5}</td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" title="Edit" data-edit="${p.id}">✏️</button>
            <button class="icon-btn" title="Update Stok" data-stock="${p.id}">📦</button>
            <button class="icon-btn danger" title="Hapus" data-delete="${p.id}">🗑</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Bind row actions
    tbody.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => openEditModal(btn.dataset.edit)));
    tbody.querySelectorAll('[data-stock]').forEach(btn => btn.addEventListener('click', () => openStockModal(btn.dataset.stock)));
    tbody.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', () => deleteProduct(btn.dataset.delete)));
  }

  /* ---------- Product Modal ---------- */
  function openAddModal() {
    editingId = null;
    document.getElementById('product-modal-title').textContent = 'Tambah Produk';
    document.getElementById('prod-id').value = '';
    document.getElementById('prod-name').value = '';
    document.getElementById('prod-category').value = 'Casing';
    document.getElementById('prod-brand').value = '';
    document.getElementById('prod-compat').value = '';
    document.getElementById('prod-variant').value = '';
    document.getElementById('prod-cost').value = '';
    document.getElementById('prod-price').value = '';
    document.getElementById('prod-stock').value = '';
    document.getElementById('prod-minstock').value = DB.getSettings().minStockDefault || 5;
    App.openModal('modal-product');
    document.getElementById('prod-name').focus();
  }

  function openEditModal(id) {
    const p = DB.getProducts().find(p => p.id === id);
    if (!p) return;
    editingId = id;
    document.getElementById('product-modal-title').textContent = 'Edit Produk';
    document.getElementById('prod-id').value = p.id;
    document.getElementById('prod-name').value = p.name;
    document.getElementById('prod-category').value = p.category;
    document.getElementById('prod-brand').value = p.brand || '';
    document.getElementById('prod-compat').value = (p.compatible || []).join(', ');
    document.getElementById('prod-variant').value = p.variant || '';
    document.getElementById('prod-cost').value = p.cost;
    document.getElementById('prod-price').value = p.price;
    document.getElementById('prod-stock').value = p.stock;
    document.getElementById('prod-minstock').value = p.minStock || 5;
    App.openModal('modal-product');
    document.getElementById('prod-name').focus();
  }

  function saveProduct() {
    const name = document.getElementById('prod-name').value.trim();
    const cost = parseFloat(document.getElementById('prod-cost').value);
    const price = parseFloat(document.getElementById('prod-price').value);
    const stock = parseInt(document.getElementById('prod-stock').value);

    if (!name) return showToast('Nama produk wajib diisi', 'error');
    if (isNaN(cost) || cost < 0) return showToast('Harga beli tidak valid', 'error');
    if (isNaN(price) || price < 0) return showToast('Harga jual tidak valid', 'error');
    if (isNaN(stock) || stock < 0) return showToast('Stok tidak valid', 'error');

    const compatRaw = document.getElementById('prod-compat').value;
    const compatible = compatRaw ? compatRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

    const products = DB.getProducts();

    if (editingId) {
      const idx = products.findIndex(p => p.id === editingId);
      if (idx === -1) return;
      const prevStock = products[idx].stock;
      products[idx] = {
        ...products[idx],
        name,
        category: document.getElementById('prod-category').value,
        brand: document.getElementById('prod-brand').value.trim(),
        compatible,
        variant: document.getElementById('prod-variant').value.trim(),
        cost,
        price,
        stock,
        minStock: parseInt(document.getElementById('prod-minstock').value) || 5,
        updatedAt: Date.now(),
      };
      // Log stock change if different
      if (stock !== prevStock) {
        const diff = stock - prevStock;
        const log = DB.getStockLog();
        log.push({
          id: DB.uid('log_'),
          productId: editingId,
          productName: name,
          type: diff > 0 ? 'in' : 'adjust',
          change: diff,
          note: 'Penyesuaian manual via edit produk',
          timestamp: Date.now(),
        });
        DB.saveStockLog(log);
      }
    } else {
      products.push({
        id: DB.uid('p_'),
        name,
        category: document.getElementById('prod-category').value,
        brand: document.getElementById('prod-brand').value.trim(),
        compatible,
        variant: document.getElementById('prod-variant').value.trim(),
        cost,
        price,
        stock,
        minStock: parseInt(document.getElementById('prod-minstock').value) || 5,
        createdAt: Date.now(),
      });
    }

    DB.saveProducts(products);
    App.closeModal('modal-product');
    render();
    POS.refresh();
    showToast(editingId ? 'Produk berhasil diperbarui' : 'Produk berhasil ditambahkan', 'success');
  }

  function deleteProduct(id) {
    const p = DB.getProducts().find(p => p.id === id);
    if (!p) return;
    if (!confirm(`Hapus produk "${p.name}"? Data tidak dapat dipulihkan.`)) return;
    const products = DB.getProducts().filter(p => p.id !== id);
    DB.saveProducts(products);
    render();
    POS.refresh();
    showToast('Produk dihapus', '');
  }

  /* ---------- Stock Adjustment Modal ---------- */
  function openStockModal(id) {
    const p = DB.getProducts().find(p => p.id === id);
    if (!p) return;
    document.getElementById('stock-prod-id').value = p.id;
    document.getElementById('stock-prod-name').textContent = p.name;
    document.getElementById('stock-current').value = p.stock + ' pcs';
    document.getElementById('stock-type').value = 'in';
    document.getElementById('stock-amount').value = 0;
    document.getElementById('stock-note').value = '';
    App.openModal('modal-stock');
    document.getElementById('stock-amount').focus();
  }

  function saveStockAdjustment() {
    const id = document.getElementById('stock-prod-id').value;
    const type = document.getElementById('stock-type').value;
    const amount = parseInt(document.getElementById('stock-amount').value) || 0;
    const note = document.getElementById('stock-note').value.trim();

    if (amount < 0) return showToast('Jumlah tidak boleh negatif', 'error');

    const products = DB.getProducts();
    const idx = products.findIndex(p => p.id === id);
    if (idx === -1) return;

    const prevStock = products[idx].stock;
    let newStock, change;

    if (type === 'in') {
      newStock = prevStock + amount;
      change = amount;
    } else {
      newStock = amount;
      change = amount - prevStock;
    }

    products[idx].stock = Math.max(0, newStock);
    DB.saveProducts(products);

    const log = DB.getStockLog();
    log.push({
      id: DB.uid('log_'),
      productId: id,
      productName: products[idx].name,
      type,
      change,
      note: note || (type === 'in' ? 'Restok barang masuk' : 'Penyesuaian stok manual'),
      timestamp: Date.now(),
    });
    DB.saveStockLog(log);

    App.closeModal('modal-stock');
    render();
    POS.refresh();
    showToast('Stok berhasil diperbarui', 'success');
  }

  /* ---------- Init ---------- */
  function init() {
    document.getElementById('btn-add-product').addEventListener('click', openAddModal);
    document.getElementById('btn-save-product').addEventListener('click', saveProduct);
    document.getElementById('btn-save-stock').addEventListener('click', saveStockAdjustment);
    document.getElementById('inv-search').addEventListener('input', render);
  }

  return { init, render };
})();
