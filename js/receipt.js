/* ============================================================
   receipt.js — Struk Transaksi & Cetak Printer Thermal
   ============================================================ */

const Receipt = (() => {

  function show(transaction, settings) {
    const html = buildReceiptHTML(transaction, settings);
    document.getElementById('receipt-content').innerHTML = html;
    App.openModal('modal-receipt');

    document.getElementById('btn-print-receipt').onclick = () => print(transaction, settings);
  }

  function buildReceiptHTML(t, settings) {
    const storeName = settings.storeName || 'Toko Aksesoris HP';
    const storeAddress = settings.storeAddress || '';
    const storePhone = settings.storePhone || '';
    const footer = settings.receiptFooter || 'Terima kasih!';

    const itemsHTML = t.items.map(item => {
      let discountText = '';
      if (item.discountValue > 0) {
        const dStr = item.discountType === 'percent'
          ? `Diskon ${item.discountValue}%`
          : `Diskon ${formatRupiah(item.discountValue)}`;
        discountText = `<div style="font-size:10px;color:#666;padding-left:4px">  (${dStr})</div>`;
      }
      return `
        <div class="r-item-name">${escapeHtml(item.name)}</div>
        <div class="r-row" style="font-size:11px">
          <span>  ${item.qty} x ${formatRupiah(item.price)}</span>
          <span>${formatRupiah(item.lineTotal)}</span>
        </div>
        ${discountText}
      `;
    }).join('');

    const taxRow = t.tax > 0
      ? `<div class="r-row"><span>Pajak</span><span>${formatRupiah(t.tax)}</span></div>`
      : '';

    const changeRow = t.paymentMethod === 'Tunai'
      ? `<div class="r-row"><span>Uang Diterima</span><span>${formatRupiah(t.received)}</span></div>
         <div class="r-row"><span>Kembalian</span><span>${formatRupiah(t.change)}</span></div>`
      : '';

    return `
      <div class="r-center r-bold">${escapeHtml(storeName)}</div>
      ${storeAddress ? `<div class="r-center" style="font-size:11px">${escapeHtml(storeAddress)}</div>` : ''}
      ${storePhone ? `<div class="r-center" style="font-size:11px">Telp: ${escapeHtml(storePhone)}</div>` : ''}
      <div class="r-line"></div>
      <div class="r-row" style="font-size:11px">
        <span>${formatDate(t.timestamp)}</span>
        <span>${escapeHtml(t.cashierName)}</span>
      </div>
      <div style="font-size:11px">No: <strong>${escapeHtml(t.receiptNo)}</strong></div>
      <div class="r-line"></div>
      ${itemsHTML}
      <div class="r-line"></div>
      <div class="r-row"><span>Subtotal</span><span>${formatRupiah(t.subtotal)}</span></div>
      ${t.discount > 0 ? `<div class="r-row"><span>Diskon</span><span>- ${formatRupiah(t.discount)}</span></div>` : ''}
      ${taxRow}
      <div class="r-row r-bold" style="font-size:14px;margin:4px 0"><span>TOTAL</span><span>${formatRupiah(t.total)}</span></div>
      <div class="r-row" style="font-size:11px"><span>Metode</span><span>${escapeHtml(t.paymentMethod)}</span></div>
      ${changeRow}
      <div class="r-line"></div>
      <div class="r-center" style="font-size:11px">${escapeHtml(footer)}</div>
    `;
  }

  function print(t, settings) {
    const printerWidth = settings.printerSize === '80' ? '80mm' : '58mm';
    const html = `
      <!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <style>
        @media print { body { width:${printerWidth}; margin:0; } }
        body { font-family:'Courier New',monospace; font-size:11px; width:${printerWidth};
               margin:0 auto; padding:4px; line-height:1.5; }
        .r-center { text-align:center; }
        .r-bold { font-weight:700; }
        .r-line { border-top:1px dashed #000; margin:6px 0; }
        .r-row { display:flex; justify-content:space-between; }
        .r-item-name { font-weight:600; }
      </style>
      </head><body>
      ${buildReceiptHTML(t, settings)}
      </body></html>
    `;
    const win = window.open('', '_blank', 'width=400,height=600');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  }

  return { show };
})();
