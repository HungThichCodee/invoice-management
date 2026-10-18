import { api, esc, money, dateText, icon, button, field, formData, checkNumbers, today } from "../ui.js";

export async function bulkDialog(ctx, customerId) {
  const customer = await api["customers.get"](customerId);
  const bills = (await api["invoices.list"]({ customerId })).filter((row) => row.balance > 0)
    .sort((a, b) => a.invoice_date.localeCompare(b.invoice_date) || a.id.localeCompare(b.id));
  const total = bills.reduce((sum, row) => sum + row.balance, 0);
  if (!total) throw Error("Khách hàng không còn công nợ.");
  ctx.modal(`<div class="modal-head bulk-head"><div class="flex gap"><div class="metric-icon blue">${icon("account_balance_wallet")}</div><div><h2>Thu gộp công nợ</h2><p class="subtitle">${esc(customer.name)} · ${esc(customer.code)}</p></div></div>${button(icon("close"), "close", "icon-only white", "data-close")}</div>
    <form id="bulkForm" class="stack"><div class="bulk-summary"><div><span>Tổng công nợ hiện tại</span><strong class="red">${money(total)}</strong><span>· ${bills.length} hóa đơn chưa quyết toán</span></div>${button(`${icon("check_circle")} Thu hết ${money(total)}`, "full", "compact white")}</div>
      <div><div class="between bulk-label"><label for="bulkAmount">Số tiền thu kỳ này (₫) *</label><span>Giới hạn: ≤ ${money(total)}</span></div><div class="bulk-amount"><input id="bulkAmount" name="amount" type="number" min="0" max="${total}" step="1" value="${total}" required><span>₫</span></div><div class="small muted">Không được nhập vượt quá tổng số nợ.</div></div>
      <div><div class="bulk-label">CHIẾN LƯỢC PHÂN BỔ CÔNG NỢ</div><div class="bulk-mode-grid"><button type="button" class="bulk-mode active" data-strategy="auto"><strong>${icon("autorenew")} Trừ tự động từ HĐ cũ nhất</strong><span>Ưu tiên hóa đơn lập trước để giảm nợ tồn</span></button><button type="button" class="bulk-mode" data-strategy="manual"><strong>${icon("tune")} Phân bổ thủ công</strong><span>Tự nhập số tiền cho từng hóa đơn</span></button></div></div>
      <div><div class="between bulk-label"><span>BẢNG PHÂN BỔ CHI TIẾT THEO HÓA ĐƠN</span><span id="bulkCount"></span></div><div class="table-wrap"><table class="bulk-table"><thead><tr><th>Mã hóa đơn</th><th>Hạn thanh toán</th><th class="right">Còn nợ cũ</th><th class="right">Thu lần này</th><th class="right">Sau thu</th></tr></thead><tbody id="bulkRows"></tbody></table></div></div>
      <div class="bulk-result" id="bulkResult"></div><div class="fields">${field("Ngày thực tế thu", "date", today(), "date", "required")}<div class="field"><label>Hình thức thu tiền</label><input type="hidden" name="method" value="bank"><div class="payment-methods"><button type="button" data-method="cash">Tiền mặt</button><button type="button" data-method="bank" class="active">Chuyển khoản</button><button type="button" data-method="other">Khác</button></div></div></div>
      <div class="field"><label for="bulkNote">Ghi chú thu tiền</label><input id="bulkNote" name="note" placeholder="Nội dung thu tiền (tùy chọn)"></div><div class="bulk-footer"><span>${icon("description")} Hệ thống tạo phiếu thu cho từng hóa đơn được phân bổ</span>${button("Hủy", "cancel", "white", "data-close")}<button type="submit" class="button primary" id="bulkSubmit">Lưu phiếu thu</button></div></form>`, (box) => {
    box.classList.add("wide", "bulk-dialog");
    const form = box.querySelector("#bulkForm");
    const amount = form.elements.amount;
    let strategy = "auto", version = 0;
    const rows = box.querySelector("#bulkRows");
    const entries = () => [...rows.querySelectorAll("[data-allocation]")].map((input) => ({ invoiceId: input.dataset.allocation,
      balance: bills.find((row) => row.id === input.dataset.allocation).balance, amount: Number(input.value) }));
    const renderRows = (allocations) => {
      const values = new Map(allocations.map((row) => [row.invoiceId, row.amount]));
      rows.innerHTML = bills.map((row) => `<tr><td><strong class="blue">${esc(row.id)}</strong><div class="small muted">Lập ${dateText(row.invoice_date)}</div></td><td>${dateText(row.due_date)}</td><td class="right strong">${money(row.balance)}</td><td class="right"><input type="number" min="0" max="${row.balance}" step="1" data-allocation="${esc(row.id)}" value="${values.get(row.id) || 0}" ${strategy === "auto" ? "readonly" : ""}></td><td class="right strong" data-after="${esc(row.id)}"></td></tr>`).join("");
    };
    const showResult = (error = "") => {
      const allocated = entries().reduce((sum, row) => sum + row.amount, 0);
      const current = Number(amount.value) || 0;
      for (const row of entries()) rows.querySelector(`[data-after="${row.invoiceId}"]`).textContent = money(Math.max(0, row.balance - row.amount));
      const result = box.querySelector("#bulkResult");
      const difference = current - allocated;
      result.classList.toggle("invalid", !!error || difference !== 0);
      result.innerHTML = `<strong>Tổng thu kỳ này: ${money(current)}</strong><span>${error ? esc(error) : difference ? `Chênh lệch phân bổ: ${money(Math.abs(difference))}` : `Còn nợ sau thu: ${money(total - current)}`}</span>`;
      box.querySelector("#bulkCount").textContent = `${entries().filter((row) => row.amount > 0).length}/${bills.length} hóa đơn`;
      box.querySelector("#bulkSubmit").textContent = `Lưu ${entries().filter((row) => row.amount > 0).length} phiếu thu (${money(current)})`;
    };
    const plan = async () => {
      const thisVersion = ++version;
      if (strategy === "manual") { showResult(); return; }
      try {
        const allocations = await api["debts.allocate"]({ customerId, amount: Number(amount.value) });
        if (thisVersion !== version) return;
        renderRows(allocations);
        showResult();
      } catch (error) { if (thisVersion === version) showResult(error.message); }
    };
    renderRows(bills.map((row) => ({ invoiceId: row.id, amount: row.balance })));
    showResult();
    box.querySelectorAll("[data-strategy]").forEach((choice) => choice.addEventListener("click", () => {
      strategy = choice.dataset.strategy;
      box.querySelectorAll("[data-strategy]").forEach((node) => node.classList.toggle("active", node === choice));
      if (strategy === "auto") plan();
      else { rows.querySelectorAll("[data-allocation]").forEach((input) => { input.readOnly = false; }); showResult(); }
    }));
    rows.addEventListener("input", (event) => { if (event.target.matches("[data-allocation]")) showResult(); });
    amount.addEventListener("input", plan);
    box.querySelector("[data-action=full]").addEventListener("click", () => { amount.value = total; plan(); });
    box.querySelectorAll("[data-method]").forEach((choice) => choice.addEventListener("click", () => {
      form.elements.method.value = choice.dataset.method;
      box.querySelectorAll("[data-method]").forEach((node) => node.classList.toggle("active", node === choice));
    }));
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        checkNumbers(form);
        const allocations = entries().filter((row) => row.amount > 0)
          .map((row) => strategy === "auto" ? { invoiceId: row.invoiceId, amount: row.amount } : row);
        const input = { ...formData(form), customerId, amount: Number(amount.value), strategy, allocations };
        const outcome = await ctx.perform(event.submitter, {
          title: "Tạo phiếu thu gộp?", message: `Ghi nhận ${allocations.length} phiếu thu, tổng ${money(input.amount)}?`,
          label: "Tạo phiếu thu", loading: "Đang lưu…", success: "Tạo phiếu thu thành công.",
        }, () => api["debts.collect"](input));
        if (outcome.ok) { ctx.closeModal(true); ctx.refresh(); }
      } catch (error) { ctx.toast(error.message, true); }
    });
  });
}
