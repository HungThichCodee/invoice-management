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
import { openDebtProfile } from "./debtProfile.js";
import { bulkDialog } from "./bulkDialog.js";
let view = "invoices",
  filter = "all";
export async function render(_ctx, args = {}) {
  if (args.filter) filter = args.filter;
  const [bills, clients] = await Promise.all([
    api["invoices.list"]({}),
    api["customers.list"](""),
  ]);
  const open = bills.filter((i) => i.balance > 0);
  const overdue = open.filter((i) => i.status === "overdue"),
    total = open.reduce((n, i) => n + i.balance, 0);
  const filtered =
    filter === "overdue"
      ? overdue
      : filter === "soon"
        ? open.filter((i) => i.status !== "overdue")
        : open;
  const invoiceRows = filtered
    .map(
      (i) =>
        `<tr class="clickable-row" data-invoice-row="${esc(i.id)}"><td><a href="#" class="blue strong" data-invoice="${esc(i.id)}">${esc(i.id)}</a></td><td><a href="#" data-client="${i.customer_id}">${esc(displayName(i.customer_name))}</a></td><td>${dateText(i.due_date)}</td><td>${pill(i.status)}</td><td class="right">${money(i.total)}</td><td class="right strong red">${money(i.balance)}</td><td>${button("Thu tiền", `pay:${i.id}`, "compact primary")}</td></tr>`,
    )
    .join("");
  const customerRows = clients
    .filter((c) => c.balance > 0)
    .map(
      (c) =>
        `<tr class="clickable-row" data-customer-row="${c.id}"><td><a href="#" data-client="${c.id}" class="blue strong">${esc(displayName(c.name))}</a></td><td>${esc(c.phone)}</td><td class="right">${money(c.total)}</td><td class="right">${money(c.paid)}</td><td class="right strong red">${money(c.balance)}</td><td>${button("Thu gộp", `bulk:${c.id}`, "compact primary")}</td></tr>`,
    )
    .join("");
  return `<div class="page-head"><div><h1>Công nợ</h1><p class="subtitle">Theo dõi hóa đơn chưa thu đủ và tuổi nợ</p></div><div class="page-actions">${button("Xuất đối chiếu PDF", "pdf")}${button("Xuất Excel", "excel")}</div></div>
    <div class="grid4 mb16"><div class="card"><div class="metric-label">Tổng công nợ</div><div class="metric">${money(total)}</div></div><div class="card ${overdue.length ? "danger" : ""}"><div class="metric-label">Nợ quá hạn</div><div class="metric ${overdue.length ? "red" : "green"}">${money(overdue.reduce((n, i) => n + i.balance, 0))}</div>${overdue.length ? "" : '<div class="small muted">Không có nợ quá hạn</div>'}</div><div class="card"><div class="metric-label">Hóa đơn còn nợ</div><div class="metric">${open.length}</div></div><div class="card"><div class="metric-label">Khách hàng đang nợ</div><div class="metric">${clients.filter((c) => c.balance > 0).length}</div></div></div>
    <div class="grid3 mb16"><div class="card col2"><h2>Tuổi nợ</h2>${[
      ["Chưa đến hạn", open.filter((i) => i.status !== "overdue")],
      [
        "Quá hạn 1–30 ngày",
        overdue.filter(
          (i) => (Date.now() - Date.parse(i.due_date)) / 86400000 <= 30,
        ),
      ],
      [
        "Quá hạn trên 30 ngày",
        overdue.filter(
          (i) => (Date.now() - Date.parse(i.due_date)) / 86400000 > 30,
        ),
      ],
    ]
      .map(
        ([label, rows]) =>
          `<div class="stat-row"><span>${label}</span><strong>${money(rows.reduce((n, i) => n + i.balance, 0))}</strong></div>`,
      )
      .join("")}</div><div class="card"><h2>Khách nợ nhiều nhất</h2>${
      clients
        .filter((c) => c.balance > 0)
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 4)
        .map(
          (c) =>
            `<div class="stat-row"><span>${esc(c.name)}</span><strong class="red">${money(c.balance)}</strong></div>`,
        )
        .join("") || empty()
    }</div></div>
    <section class="card"><div class="between"><div class="tabs"><button class="tab ${view === "invoices" ? "active" : ""}" data-view="invoices">Theo hóa đơn</button><button class="tab ${view === "customers" ? "active" : ""}" data-view="customers">Theo khách hàng</button></div><div class="filterbar"><select id="filter"><option value="all">Tất cả</option><option value="overdue">Quá hạn</option><option value="soon">Sắp đến hạn</option></select></div></div><div class="table-wrap"><table>${view === "invoices" ? `<thead><tr><th>Mã HĐ</th><th>Khách hàng</th><th>Hạn trả</th><th>Trạng thái</th><th class="right">Tổng tiền</th><th class="right">Còn nợ</th><th></th></tr></thead><tbody>${invoiceRows || `<tr><td colspan="7">${empty()}</td></tr>`}</tbody>` : `<thead><tr><th>Khách hàng</th><th>Điện thoại</th><th class="right">Doanh số</th><th class="right">Đã thu</th><th class="right">Còn nợ</th><th></th></tr></thead><tbody>${customerRows || `<tr><td colspan="6">${empty()}</td></tr>`}</tbody>`}</table></div></section>`;
}
export function bind(root, ctx, args) {
  root.querySelector("#filter").value = filter;
  root.querySelector("#filter").addEventListener("change", (e) => {
    filter = e.target.value;
    ctx.navigate("debts", { filter });
  });
  root.addEventListener("click", async (e) => {
    const v = e.target.closest("[data-view]");
    if (v) {
      view = v.dataset.view;
      ctx.refresh();
      return;
    }
    const client = e.target.closest("[data-client]");
    if (client) {
      e.preventDefault();
      try { await openDebtProfile(ctx, Number(client.dataset.client), bulkDialog); }
      catch (error) { ctx.toast(error.message, true); }
      return;
    }
    const invoice = e.target.closest("[data-invoice]");
    if (invoice) {
      e.preventDefault();
      ctx.navigate("invoices", { openId: invoice.dataset.invoice });
      return;
    }
    if (!e.target.closest("button,a")) {
      const debtRow = e.target.closest("[data-invoice-row]");
      if (debtRow) {
        ctx.navigate("invoices", { openId: debtRow.dataset.invoiceRow });
        return;
      }
      const customerRow = e.target.closest("[data-customer-row]");
      if (customerRow) {
        try { await openDebtProfile(ctx, Number(customerRow.dataset.customerRow), bulkDialog); }
        catch (error) { ctx.toast(error.message, true); }
        return;
      }
    }
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    try {
      if (action.startsWith("pay:"))
        ctx.navigate("payments", { invoiceId: action.slice(4), open: true });
      if (action.startsWith("bulk:")) bulkDialog(ctx, Number(action.slice(5)));
      if (action === "pdf")
        ctx.toast(
          `Đã xuất ${await api["exports.pdf"]({ kind: "debts", filter: { status: filter } })}`,
        );
      if (action === "excel")
        ctx.toast(
          `Đã xuất ${await api["exports.excel"]({ kind: "debts", filter: { status: filter } })}`,
        );
    } catch (x) {
      ctx.toast(x.message, true);
    }
  });
  if (args.open && args.customerId)
    bulkDialog(ctx, Number(args.customerId)).catch((x) =>
      ctx.toast(x.message, true),
    );
}
