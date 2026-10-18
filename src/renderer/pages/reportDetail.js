import {
  api,
  esc,
  displayName,
  money,
  dateText,
  icon,
  button,
  empty,
  today,
} from "../ui.js";
import { revenueChart } from "../widgets/revenueChart.js";
function dailyRows(month, invoices, payments) {
  const year = Number(month.slice(0, 4)),
    index = Number(month.slice(5));
  const days = new Date(Date.UTC(year, index, 0)).getUTCDate();
  return Array.from({ length: days }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, "0")}`;
    return {
      period: date,
      revenue: invoices
        .filter((row) => row.invoice_date === date)
        .reduce((sum, row) => sum + row.total, 0),
      collected: payments
        .filter((row) => row.pay_date === date)
        .reduce((sum, row) => sum + row.amount, 0),
    };
  });
}
function methodPanel(payments) {
  const methods = [
    ["bank", "Chuyển khoản", "#2563eb"],
    ["cash", "Tiền mặt", "#15803d"],
    ["other", "Khác", "#f59e0b"],
  ];
  const total = payments.reduce((sum, row) => sum + row.amount, 0);
  let start = 0;
  const segments = methods.map(([key, , color]) => {
    const amount = payments
      .filter((row) => row.method === key)
      .reduce((sum, row) => sum + row.amount, 0);
    const end = start + (total ? (amount / total) * 100 : 0),
      segment = `${color} ${start}% ${end}%`;
    start = end;
    return segment;
  });
  const style = total
    ? `background:conic-gradient(${segments.join(",")})`
    : "background:var(--pale)";
  const rows = methods
    .map(([key, label, color]) => {
      const value = payments
        .filter((row) => row.method === key)
        .reduce((sum, row) => sum + row.amount, 0);
      return `<div class="method-row"><span><i style="background:${color}"></i>${label}</span><strong>${money(value)}</strong><small>${total ? Math.round((value / total) * 100) : 0}%</small></div>`;
    })
    .join("");
  return `<section class="card"><h2>Tiền thu theo phương thức</h2><div class="donut" style="${style}" role="img" aria-label="Tổng tiền thu ${money(total)}"><div><small>Tổng thu</small><strong>${money(total)}</strong></div></div>${rows}</section>`;
}
export async function render(_ctx, args) {
  const key = args.month || today().slice(0, 7),
    d = await api["reports.month"](key);
  const bills = d.invoices
    .map(
      (i) =>
        `<tr><td><a href="#" data-invoice="${esc(i.id)}" class="blue strong">${esc(i.id)}</a></td><td>${dateText(i.invoice_date)}</td><td class="customer-cell">${esc(displayName(i.customer_name))}</td><td class="right">${money(i.total)}</td><td class="right green">${money(i.paid)}</td><td class="right">${money(i.balance)}</td></tr>`,
    )
    .join("");
  const receipts = d.payments
    .slice(0, 5)
    .map(
      (p) =>
        `<div class="receipt-line"><div><strong>${esc(p.id)}</strong><span class="small muted">${dateText(p.pay_date)} · ${esc(p.invoice_id)}</span></div><strong class="green">${money(p.amount)}</strong></div>`,
    )
    .join("");
  const days = dailyRows(key, d.invoices, d.payments);
  const rate = d.collectionRate;
  return `<div class="page-head"><div><p class="subtitle">Báo cáo / Chi tiết tháng</p><h1>Tháng ${esc(key.slice(5))}/${esc(key.slice(0, 4))}</h1></div><div class="page-actions">${button("‹ Tháng trước", "prev")}${button("Tháng sau ›", "next")}${button(`${icon("picture_as_pdf")} PDF`, "pdf")}${button("Xuất Excel", "excel")}</div></div>
    <div class="report-kpis mb16"><div class="card"><div class="metric-label">Doanh thu tháng</div><div class="metric blue">${money(d.summary.revenue)}</div></div><div class="card"><div class="metric-label">Tiền thu trong tháng</div><div class="metric green">${money(d.summary.collected)}</div></div><div class="card"><div class="metric-label">Nợ cuối tháng</div><div class="metric ${d.closingDebt ? "red" : "green"}">${money(d.closingDebt)}</div></div><div class="card"><div class="metric-label">Hóa đơn phát sinh</div><div class="metric">${d.summary.invoices}</div></div><div class="card"><div class="metric-label">Đã thu trên HĐ tháng</div><div class="metric blue">${rate}%</div></div></div>
    <section class="card mb16"><div class="card-head"><h2>Diễn biến doanh thu và tiền thu hằng ngày</h2><div class="chart-legend"><span class="legend-revenue"></span> Doanh thu <span class="legend-cash"></span> Tiền thu</div></div>${d.summary.revenue || d.summary.collected ? revenueChart(days, "day") : empty("Chưa có phát sinh trong tháng")}</section>
    <div class="report-detail-layout"><section class="card"><div class="card-head"><h2>Hóa đơn trong tháng</h2><span class="pill">${d.invoices.length} hóa đơn</span></div><div class="table-wrap"><table class="report-invoice-table"><thead><tr><th>Mã HĐ</th><th>Ngày</th><th>Khách hàng</th><th class="right">Tổng tiền</th><th class="right">Đã thu</th><th class="right">Còn nợ</th></tr></thead><tbody>${bills || `<tr><td colspan="6">${empty()}</td></tr>`}</tbody></table></div></section><div class="report-side">${methodPanel(d.payments)}<section class="card"><div class="card-head"><h2>Phiếu thu trong tháng</h2><span class="pill">${d.payments.length} phiếu</span></div>${receipts || empty("Chưa có phiếu thu")}${button("Xem tất cả phiếu thu →", "payments", "w100 white")}</section></div></div>`;
}
export function bind(root, ctx, args) {
  root.addEventListener("click", async (e) => {
    const invoice = e.target.closest("[data-invoice]");
    if (invoice) {
      e.preventDefault();
      ctx.navigate("invoices", { openId: invoice.dataset.invoice });
      return;
    }
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    const month = args.month || today().slice(0, 7),
      date = new Date(`${month}-01T00:00:00Z`);
    try {
      if (action === "prev" || action === "next") {
        date.setUTCMonth(date.getUTCMonth() + (action === "prev" ? -1 : 1));
        ctx.navigate("reportDetail", { month: date.toISOString().slice(0, 7) });
      }
      if (action === "pdf")
        ctx.toast(
          `Đã xuất ${await api["exports.pdf"]({ kind: "report", filter: { month } })}`,
        );
      if (action === "excel")
        ctx.toast(
          `Đã xuất ${await api["exports.excel"]({ reportMonth: month })}`,
        );
      if (action === "payments")
        ctx.navigate("payments", { from: `${month}-01`, to: `${month}-31` });
    } catch (x) {
      ctx.toast(x.message, true);
    }
  });
}
