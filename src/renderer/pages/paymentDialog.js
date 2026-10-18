import { api, esc, money, icon, button, field, formData, checkNumbers, today } from "../ui.js";

export async function paymentDialog(ctx, invoiceId = "") {
  const open = (await api["invoices.list"]({})).filter((row) => row.balance > 0);
  if (!open.length) throw Error("Không có hóa đơn cần thu tiền.");
  const chosen = open.find((row) => row.id === invoiceId) || open[0];
  const options = open.map((row) => `<option value="${esc(row.id)}" ${row.id === chosen.id ? "selected" : ""}>${esc(row.id)} · ${esc(row.customer_name)} · Còn ${money(row.balance)}</option>`).join("");
  ctx.modal(`<div class="modal-head payment-dialog-head"><div class="flex gap"><div class="metric-icon blue">${icon("payments")}</div><div><h2 id="paymentTitle">Thu tiền – ${esc(chosen.id)}</h2><p class="subtitle" id="paymentCustomer">${esc(chosen.customer_name)} · ${esc(chosen.customer_code || "")}</p></div></div>${button(icon("close"), "close", "icon-only white", "data-close")}</div>
    <form id="paymentForm" class="stack"><label class="payment-invoice-picker">Hóa đơn cần thu<select name="invoiceId" aria-label="Chọn hóa đơn">${options}</select></label>
      <div class="payment-overview"><div><span>TỔNG HÓA ĐƠN</span><strong id="paymentTotal">${money(chosen.total)}</strong></div><div><span>ĐÃ THU TRƯỚC</span><strong id="paymentPaid" class="green">${money(chosen.paid)}</strong></div><div><span>CÒN NỢ LẠI</span><strong id="paymentBalance" class="red">${money(chosen.balance)}</strong></div></div>
      <div><div class="payment-section-label">Phương án thu tiền</div><div class="payment-mode-grid"><button type="button" class="payment-mode active" data-mode="full"><strong>${icon("check_circle")} Thu đủ – trả hết</strong><span>Thu toàn bộ dư nợ trong một lần</span></button><button type="button" class="payment-mode" data-mode="partial"><strong>${icon("radio_button_unchecked")} Thu một phần</strong><span>Phần còn lại sẽ thu sau</span></button></div></div>
      <div><div class="between payment-section-label"><label for="paymentAmount">Số tiền thu kỳ này</label><span>Tối đa: <strong id="paymentMax">${money(chosen.balance)}</strong></span></div><div class="payment-amount-box">${icon("payments")}<input id="paymentAmount" name="amount" type="number" min="0" max="${chosen.balance}" step="1" value="${chosen.balance}" required readonly><span>₫</span></div><div class="payment-shortcuts"><span>Tỷ lệ nhanh:</span>${[25, 50, 75, 100].map((n) => button(`${n}%`, `pct${n}`, "compact white")).join("")}</div></div>
      <div class="payment-result" id="paymentResult"></div><div class="fields">${field("Ngày thu tiền", "date", today(), "date", "required")}<div class="field"><label>Hình thức thu</label><input type="hidden" name="method" value="bank"><div class="payment-methods"><button type="button" data-method="cash">Tiền mặt</button><button type="button" data-method="bank" class="active">Chuyển khoản</button><button type="button" data-method="other">Khác</button></div></div></div>
      <div class="field"><label for="paymentNote">Ghi chú thu tiền</label><input id="paymentNote" name="note" placeholder="Nội dung thu tiền (tùy chọn)"></div><div class="payment-dialog-footer"><span>${icon("lock")} Cập nhật ngay vào sổ quỹ và công nợ</span>${button("Hủy", "cancel", "white", "data-close")}<button type="submit" class="button primary" id="paymentSubmit">Thu đủ ${money(chosen.balance)}</button></div></form>`, (box) => {
    box.classList.add("payment-dialog");
    const form = box.querySelector("#paymentForm");
    const picker = form.elements.invoiceId;
    const amount = form.elements.amount;
    let mode = "full";
    const current = () => open.find((row) => row.id === picker.value);
    const update = () => {
      const row = current();
      const paid = Number(amount.value) || 0;
      const remaining = Math.max(0, row.balance - paid);
      box.querySelector("#paymentResult").innerHTML = `${icon(remaining ? "info" : "check_circle")} <span>Sau khi thu còn nợ <strong>${money(remaining)}</strong> · Hóa đơn ${remaining ? "tiếp tục chờ thu" : "được thanh toán đủ"}</span>`;
      box.querySelector("#paymentSubmit").textContent = `${remaining ? "Lưu phiếu thu" : "Thu đủ"} ${money(paid)}`;
    };
    const chooseMode = (value) => {
      mode = value;
      box.querySelectorAll("[data-mode]").forEach((node) => node.classList.toggle("active", node.dataset.mode === value));
      amount.readOnly = value === "full";
      if (value === "full") amount.value = current().balance;
      update();
      if (value === "partial") amount.focus();
    };
    picker.addEventListener("change", () => {
      const row = current();
      box.querySelector("#paymentTitle").textContent = `Thu tiền – ${row.id}`;
      box.querySelector("#paymentCustomer").textContent = `${row.customer_name} · ${row.customer_code || ""}`;
      for (const [id, value] of [["paymentTotal", row.total], ["paymentPaid", row.paid], ["paymentBalance", row.balance], ["paymentMax", row.balance]]) box.querySelector(`#${id}`).textContent = money(value);
      amount.max = row.balance;
      amount.value = row.balance;
      chooseMode("full");
    });
    box.querySelectorAll("[data-mode]").forEach((node) => node.addEventListener("click", () => chooseMode(node.dataset.mode)));
    box.querySelectorAll("[data-method]").forEach((node) => node.addEventListener("click", () => {
      form.elements.method.value = node.dataset.method;
      box.querySelectorAll("[data-method]").forEach((choice) => choice.classList.toggle("active", choice === node));
    }));
    box.querySelectorAll("[data-action^=pct]").forEach((node) => node.addEventListener("click", () => {
      const percent = Number(node.dataset.action.slice(3));
      chooseMode(percent === 100 ? "full" : "partial");
      amount.value = Math.round(current().balance * percent / 100);
      update();
    }));
    amount.addEventListener("input", update);
    update();
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        checkNumbers(form);
        const input = { ...formData(form), amount: Number(amount.value) };
        const outcome = await ctx.perform(event.submitter, {
          title: "Tạo phiếu thu?", message: `Ghi nhận ${money(input.amount)} cho hóa đơn ${input.invoiceId}?`,
          label: "Tạo phiếu thu", loading: "Đang lưu…", success: "Tạo phiếu thu thành công.",
        }, () => api["payments.create"](input));
        if (outcome.ok) { ctx.closeModal(true); ctx.refresh(); }
      } catch (error) { ctx.toast(error.message, true); }
    });
  });
}
