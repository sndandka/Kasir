/* ============================================================
   reports.js — Laporan & Analitik + Ekspor CSV / PDF
   ============================================================ */

const Reports = (() => {

  /* ---------- Date helpers ---------- */
  function startOfDay(ts) {
    const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime();
  }
  function endOfDay(ts) {
    const d = new Date(ts); d.setHours(23, 59, 59, 999); return d.getTime();
  }
  function todayStart() { return startOfDay(Date.now()); }
  function weekStart() {
    const d = new Date(); d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0); return d.getTime();
  }
  function monthStart() {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.getTime();
  }
  function dateValToTs(str, endOf = false) {
    if (!str) return null;
    const d = new Date(str);
    if (endOf) d.setHours(23, 59, 59, 999);
    else d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  function dateLabel(ts) {
    return new Date(ts).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' });
  }

  function getRange() {
    const period = document.getElementById('report-period').value;
    let from, to = endOfDay(Date.now());
    if (period === 'today') from = todayStart();
    else if (period === 'week') from = weekStart();
    else if (period === 'month') from = monthStart();
    else {
      from = dateValToTs(document.getElementById('report-date-from').value) || todayStart();
      to = dateValToTs(document.getElementById('report-date-to').value, true) || to;
    }
    return { from, to };
  }

  function filterSales(sales, from, to) {
    return sales.filter(s => s.timestamp >= from && s.timestamp <= to);
  }

  /* ---------- Render ---------- */
  function render() {
    const { from, to } = getRange();
    const allSales = DB.getSales();
    const sales = filterSales(allSales, from, to);
    const products = DB.getProducts();

    // Stats
    const revenue = sales.reduce((s, t) => s + t.total, 0);
    const profit = sales.reduce((sum, t) => {
      return sum + t.items.reduce((s, item) => s + (item.price - item.cost) * item.qty, 0);
    }, 0);
    const avg = sales.length ? revenue / sales.length : 0;

    document.getElementById('stat-revenue').textContent = formatRupiah(revenue);
    document.getElementById('stat-transactions').textContent = sales.length;
    document.getElementById('stat-profit').textContent = formatRupiah(profit);
    document.getElementById('stat-avg').textContent = formatRupiah(avg);

    renderRevenueChart(sales, from, to);
    renderTopProducts(sales);
    renderSlowMoving(sales, products);
  }

  function renderRevenueChart(sales, from, to) {
    // Build day-by-day buckets
    const days = [];
    const cur = new Date(from);
    const end = new Date(to);
    while (cur <= end) {
      days.push({
        label: dateLabel(cur.getTime()),
        ts: cur.getTime(),
        total: 0,
      });
      cur.setDate(cur.getDate() + 1);
    }
    // Limit to 14 days for readability
    const displayDays = days.slice(-14);

    sales.forEach(s => {
      const idx = displayDays.findIndex(d => {
        const dayStart = d.ts;
        const dayEnd = dayStart + 86399999;
        return s.timestamp >= dayStart && s.timestamp <= dayEnd;
      });
      if (idx !== -1) displayDays[idx].total += s.total;
    });

    const maxVal = Math.max(...displayDays.map(d => d.total), 1);

    const wrap = document.getElementById('chart-revenue');
    wrap.innerHTML = '';
    const chart = document.createElement('div');
    chart.className = 'bar-chart';

    displayDays.forEach(d => {
      const heightPct = (d.total / maxVal) * 100;
      const col = document.createElement('div');
      col.className = 'bar-col';
      col.innerHTML = `
        <div class="bar" style="height:${Math.max(heightPct, 2)}%" data-tooltip="${formatRupiah(d.total)}"></div>
        <div class="bar-label">${d.label}</div>
      `;
      chart.appendChild(col);
    });

    wrap.appendChild(chart);
  }

  function renderTopProducts(sales) {
    const tally = {};
    sales.forEach(s => {
      s.items.forEach(item => {
        tally[item.name] = (tally[item.name] || 0) + item.qty;
      });
    });

    const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const maxQty = sorted.length ? sorted[0][1] : 1;

    const wrap = document.getElementById('chart-top-products');
    wrap.innerHTML = '';

    if (sorted.length === 0) {
      wrap.innerHTML = '<div class="empty-state" style="padding:20px 0">Belum ada data penjualan</div>';
      return;
    }

    sorted.forEach(([name, qty]) => {
      const pct = (qty / maxQty) * 100;
      const row = document.createElement('div');
      row.className = 'hbar-row';
      row.innerHTML = `
        <div class="hbar-label" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
        <div class="hbar-track"><div class="hbar-fill" style="width:${pct}%"></div></div>
        <div class="hbar-val">${qty}</div>
      `;
      wrap.appendChild(row);
    });
  }

  function renderSlowMoving(sales, products) {
    const tally = {};
    sales.forEach(s => {
      s.items.forEach(item => {
        tally[item.productId] = (tally[item.productId] || 0) + item.qty;
      });
    });

    // Products with 0 or low sales in the period
    const slow = products
      .map(p => ({ ...p, sold: tally[p.id] || 0 }))
      .filter(p => p.sold === 0 || p.sold < 2)
      .sort((a, b) => a.sold - b.sold)
      .slice(0, 20);

    const tbody = document.getElementById('slowmoving-tbody');
    tbody.innerHTML = '';

    if (slow.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px">Semua produk terjual dengan baik!</td></tr>';
      return;
    }

    slow.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(p.category)}</td>
        <td>${p.stock}</td>
        <td>${p.sold}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  /* ---------- History View ---------- */
  function renderHistory() {
    const from = dateValToTs(document.getElementById('history-date-from').value) || 0;
    const to = dateValToTs(document.getElementById('history-date-to').value, true) || Date.now() + 86400000;
    const sales = DB.getSales().filter(s => s.timestamp >= from && s.timestamp <= to).reverse();

    const tbody = document.getElementById('history-tbody');
    tbody.innerHTML = '';

    if (sales.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:30px">Belum ada transaksi</td></tr>';
      return;
    }

    sales.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(s.receiptNo)}</strong></td>
        <td>${formatDate(s.timestamp)}</td>
        <td>${escapeHtml(s.cashierName)}</td>
        <td>${s.items.length} item</td>
        <td><strong>${formatRupiah(s.total)}</strong></td>
        <td>${escapeHtml(s.paymentMethod)}</td>
        <td>
          <button class="btn btn-sm btn-secondary" data-view-receipt="${s.id}">🧾 Struk</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('[data-view-receipt]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sale = sales.find(s => s.id === btn.dataset.viewReceipt);
        if (sale) Receipt.show(sale, DB.getSettings());
      });
    });
  }

  /* ---------- Export CSV ---------- */
  function exportCSV() {
    const { from, to } = getRange();
    const sales = filterSales(DB.getSales(), from, to);

    if (sales.length === 0) return showToast('Tidak ada data untuk diekspor', 'error');

    const header = ['No Struk', 'Tanggal', 'Kasir', 'Item', 'Subtotal', 'Diskon', 'Pajak', 'Total', 'Metode Bayar'];
    const rows = sales.map(s => [
      s.receiptNo,
      formatDate(s.timestamp),
      s.cashierName,
      s.items.map(i => `${i.name} x${i.qty}`).join(' | '),
      s.subtotal,
      s.discount,
      s.tax || 0,
      s.total,
      s.paymentMethod,
    ]);

    const csvContent = [header, ...rows]
      .map(row => row.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan-penjualan-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV berhasil diekspor', 'success');
  }

  /* ---------- Export PDF (print-based) ---------- */
  function exportPDF() {
    const { from, to } = getRange();
    const sales = filterSales(DB.getSales(), from, to);
    if (sales.length === 0) return showToast('Tidak ada data untuk diekspor', 'error');

    const settings = DB.getSettings();
    const revenue = sales.reduce((s, t) => s + t.total, 0);
    const profit = sales.reduce((sum, t) => {
      return sum + t.items.reduce((s, item) => s + (item.price - item.cost) * item.qty, 0);
    }, 0);

    let rows = sales.map(s => `
      <tr>
        <td>${escapeHtml(s.receiptNo)}</td>
        <td>${formatDate(s.timestamp)}</td>
        <td>${escapeHtml(s.cashierName)}</td>
        <td>${s.items.length} item</td>
        <td>${formatRupiah(s.total)}</td>
        <td>${escapeHtml(s.paymentMethod)}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>Laporan Penjualan</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:12px;margin:24px;}
        h1{font-size:18px;margin-bottom:2px;}
        .summary{display:flex;gap:24px;margin:12px 0;padding:12px;background:#f3f4f6;border-radius:6px;}
        .stat{flex:1;} .stat .label{font-size:11px;color:#666;} .stat .val{font-size:16px;font-weight:700;}
        table{width:100%;border-collapse:collapse;margin-top:14px;}
        th{background:#e5e7eb;padding:7px 10px;text-align:left;font-size:11px;}
        td{padding:6px 10px;border-bottom:1px solid #e5e7eb;}
        .footer{margin-top:14px;font-size:11px;color:#666;}
      </style>
      </head><body>
      <h1>${escapeHtml(settings.storeName || 'Toko')}</h1>
      <div style="color:#666;font-size:12px">Laporan Penjualan — Dicetak ${formatDate(Date.now())}</div>
      <div class="summary">
        <div class="stat"><div class="label">Total Pendapatan</div><div class="val">${formatRupiah(revenue)}</div></div>
        <div class="stat"><div class="label">Jumlah Transaksi</div><div class="val">${sales.length}</div></div>
        <div class="stat"><div class="label">Laba Bersih</div><div class="val">${formatRupiah(profit)}</div></div>
      </div>
      <table>
        <thead><tr><th>No Struk</th><th>Tanggal</th><th>Kasir</th><th>Item</th><th>Total</th><th>Metode</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">Laporan dibuat otomatis oleh AksesorisPOS</div>
      </body></html>
    `;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  }

  /* ---------- Init ---------- */
  function init() {
    document.getElementById('report-period').addEventListener('change', () => {
      const isCustom = document.getElementById('report-period').value === 'custom';
      document.getElementById('report-date-from').style.display = isCustom ? 'block' : 'none';
      document.getElementById('report-date-to').style.display = isCustom ? 'block' : 'none';
      render();
    });
    document.getElementById('report-date-from').addEventListener('change', render);
    document.getElementById('report-date-to').addEventListener('change', render);
    document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
    document.getElementById('btn-export-pdf').addEventListener('click', exportPDF);

    // History filter
    document.getElementById('btn-history-filter').addEventListener('click', renderHistory);

    // Set default dates
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('history-date-from').value = today;
    document.getElementById('history-date-to').value = today;
    document.getElementById('report-date-from').value = today;
    document.getElementById('report-date-to').value = today;
  }

  return { init, render, renderHistory };
})();
