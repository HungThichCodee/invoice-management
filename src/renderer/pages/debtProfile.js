import {
  api,
  esc,
  displayName,
  money,
  dateText,
  icon,
  button,
  pill,
  today,
} from "../ui.js";

function dueLabel(date) {
  const days = Math.round(
    (Date.parse(`${date}T00:00:00`) - Date.parse(`${today()}T00:00:00`)) /
      86400000,
  );
  return days < 0
    ? `Quá hạn ${-days} ngày`
    : days === 0
      ? "Đến hạn hôm nay"
      : `Còn ${days} ngày`;
}
function invoiceCard(invoice) {
  return `<article class="debt-profile-invoice">
    <div class="between"><a href="#" class="blue strong" data-debt-invoice="${esc(invoice.id)}">${esc(invoice.id)}</a>${pill(invoice.status)}</div>
    <p class="small muted">Lập ngày ${dateText(invoice.invoice_date)} · Hạn ${dateText(invoice.due_date)} · ${dueLabel(invoice.due_date)}</p>
    <div class="debt-profile-values"><div><span>Tổng tiền</span><strong>${money(invoice.total)}</strong></div>
      <div><span>Đã thu</span><strong class="green">${money(invoice.paid)}</strong></div>
      <div><span>Còn nợ</span><strong class="red">${money(invoice.balance)}</strong></div></div>
    <div class="between debt-profile-actions"><span class="small muted">${esc(invoice.note || "")}</span>
      ${button(`${icon("payments")} Thu tiền`, `pay:${invoice.id}`, "compact primary")}</div>
  </article>`;
}
export async function openDebtProfile(ctx, customerId, onBulk) {
  const [customer, all] = await Promise.all([
    api["customers.get"](customerId),
    api["invoices.list"]({ customerId }),
  ]);
  const invoices = all
    .filter((row) => row.balance > 0)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const total = invoices.reduce((n, row) => n + row.balance, 0);
  const overdue = invoices.filter((row) => row.status === "overdue");
  const overdueTotal = overdue.reduce((n, row) => n + row.balance, 0);
  ctx.modal(
    `<div class="debt-profile-head"><div class="debt-profile-overline">HỒ SƠ CÔNG NỢ CHI TIẾT</div>
    <h2>${esc(displayName(customer.name))}</h2><div class="small muted">Mã: ${esc(customer.code)} · ĐT: ${esc(customer.phone || "Chưa có")}</div>
    ${button(icon("close"), "close", "icon-only white", "data-close")}</div>
    <div class="debt-profile-body"><section class="debt-profile-summary">
      <div class="between"><span>Tổng còn nợ của khách</span><span class="pill overdue">${invoices.length} hóa đơn</span></div>
      <div class="debt-profile-total">${money(total)}</div>
      <div class="between debt-profile-overdue"><span>${overdueTotal ? "Trong đó quá hạn" : "Không có nợ quá hạn"}</span>
        <strong class="${overdueTotal ? "red" : "green"}">${money(overdueTotal)} ${overdueTotal ? `(${overdue.length} HĐ)` : ""}</strong></div>
    </section><h3>${icon("receipt_long")} Danh sách hóa đơn chưa tất toán</h3>
    ${invoices.map(invoiceCard).join("") || '<div class="empty">Khách hàng không còn công nợ.</div>'}
    ${customer.note ? `<div class="debt-profile-note">${icon("info")} ${esc(customer.note)}</div>` : ""}</div>
    <div class="debt-profile-footer">${total ? button(`${icon("add_card")} Thu gộp ${money(total)}`, "bulk", "primary w100") : ""}
      ${button(`${icon("picture_as_pdf")} Xuất đối chiếu PDF`, "pdf", "w100 white")}
      ${button("Xem hồ sơ khách hàng →", "profile", "w100 white")}</div>`,
    (box) => {
      box.classList.add("debt-drawer");
      box.closest(".overlay").classList.add("drawer-overlay");
      box.addEventListener("click", async (event) => {
        const invoice = event.target.closest("[data-debt-invoice]");
        if (invoice) {
          event.preventDefault();
          ctx.closeModal();
          ctx.navigate("invoices", { openId: invoice.dataset.debtInvoice });
          return;
        }
        const action = event.target.closest("[data-action]")?.dataset.action;
        if (!action) return;
        try {
          if (action.startsWith("pay:")) {
            ctx.closeModal();
            ctx.navigate("payments", {
              invoiceId: action.slice(4),
              open: true,
            });
          }
          if (action === "bulk") {
            ctx.closeModal();
            await onBulk(ctx, customerId);
          }
          if (action === "profile") {
            ctx.closeModal();
            ctx.navigate("customerProfile", { id: customerId });
          }
          if (action === "pdf")
            ctx.toast(
              `Đã xuất ${await api["exports.pdf"]({ kind: "debts", filter: { customerId } })}`,
            );
        } catch (error) {
          ctx.toast(error.message, true);
        }
      });
    },
  );
}
