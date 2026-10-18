import {
  api,
  esc,
  displayName,
  money,
  dateText,
  icon,
  button,
  pill,
  empty,
} from "../ui.js";
import { customerDialog } from "./customers.js";
let tab = "all";
export async function render(_ctx, args) {
  const id = Number(args.id),
    [c, all, receipts] = await Promise.all([
      api["customers.get"](id),
      api["invoices.list"]({ customerId: id }),
      api["payments.list"]({ customerId: id }),
    ]);
  const total = all.reduce((n, r) => n + r.total, 0),
    paid = all.reduce((n, r) => n + r.paid, 0),
    balance = total - paid;
  const contact = [c.code, c.phone, c.address].filter(Boolean).join(" · ");
  const rows = all
    .filter((r) => tab === "all" || r.status === tab)
    .map(
      (i) =>
        `<tr><td><a class="blue strong" href="#" data-invoice="${esc(i.id)}">${esc(i.id)}</a></td><td>${dateText(i.invoice_date)}</td><td>${dateText(i.due_date)}</td><td class="right">${money(i.total)}</td><td class="right">${money(i.paid)}</td><td class="right strong">${money(i.balance)}</td><td>${pill(i.status)}</td></tr>`,
    )
    .join("");
  const timeline = receipts
    .slice(0, 10)
    .map(
      (p) =>
        `<div class="activity">${icon("payments")}<div><strong>${esc(p.id)} · ${money(p.amount)}</strong><div class="small muted">${dateText(p.pay_date)} · ${esc(p.invoice_id)}</div></div></div>`,
    )
    .join("");
  return `<div class="page-head"><div><p class="subtitle">Khách hàng / Hồ sơ</p><h1>${esc(displayName(c.name))}</h1><div class="muted">${esc(contact)}</div></div><div class="page-actions">${button("Sửa thông tin", "edit")}${button("Xuất đối chiếu PDF", "pdf")}${button("Xuất Excel", "excel")}${button("Thu gộp", "collect", "primary")}</div></div>
    <div class="grid4 mb16"><div class="card"><div class="metric-label">Tổng doanh số</div><div class="metric">${money(total)}</div></div><div class="card"><div class="metric-label">Đã thanh toán</div><div class="metric green">${money(paid)}</div></div><div class="card"><div class="metric-label">Công nợ</div><div class="metric red">${money(balance)}</div></div><div class="card"><div class="metric-label">Số hóa đơn</div><div class="metric">${all.length}</div></div></div>
    <div class="grid3"><section class="card col2"><div class="card-head"><h2>Hóa đơn của khách</h2>${button("Tạo hóa đơn", "new", "primary compact")}</div><div class="tabs">${[
      ["all", "Tất cả"],
      ["unpaid", "Còn nợ"],
      ["partial", "Trả một phần"],
      ["overdue", "Quá hạn"],
      ["paid", "Đã thanh toán"],
    ]
      .map(
        ([v, t]) =>
          `<button class="tab ${tab === v ? "active" : ""}" data-tab="${v}">${t}</button>`,
      )
      .join(
        "",
      )}</div><div class="table-wrap"><table><thead><tr><th>Mã HĐ</th><th>Ngày</th><th>Hạn trả</th><th class="right">Tổng tiền</th><th class="right">Đã thu</th><th class="right">Còn nợ</th><th>Trạng thái</th></tr></thead><tbody>${rows || `<tr><td colspan="7">${empty()}</td></tr>`}</tbody></table></div></section><section class="card"><h2>Dòng thời gian giao dịch</h2>${timeline || empty("Chưa có phiếu thu")}</section></div>`;
}
export function bind(root, ctx, args) {
  root.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-tab]");
    if (t) {
      tab = t.dataset.tab;
      ctx.refresh();
      return;
    }
    const inv = e.target.closest("[data-invoice]");
    if (inv) {
      e.preventDefault();
      ctx.navigate("invoices", { search: inv.dataset.invoice });
      return;
    }
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    try {
      if (action === "edit") customerDialog(ctx, args.id);
      if (action === "new")
        ctx.navigate("invoiceForm", { customerId: args.id });
      if (action === "collect")
        ctx.navigate("debts", { customerId: args.id, open: true });
      if (action === "pdf")
        ctx.toast(
          `Đã xuất ${await api["exports.pdf"]({ kind: "invoices", filter: { customerId: args.id } })}`,
        );
      if (action === "excel")
        ctx.toast(
          `Đã xuất ${await api["exports.excel"]({ kind: "invoices", filter: { customerId: args.id } })}`,
        );
    } catch (x) {
      ctx.toast(x.message, true);
    }
  });
}
