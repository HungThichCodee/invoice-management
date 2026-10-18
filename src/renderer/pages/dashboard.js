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
import { activityRow } from "../widgets/activity.js";
import { revenueChart } from "../widgets/revenueChart.js";
let month = today().slice(0, 7);
const monthLabel = (key) => `Tháng ${Number(key.slice(5))}/${key.slice(0, 4)}`;
function monthPicker() {
  const year = Number(month.slice(0, 4)),
    current = Number(month.slice(5));
  return `<div class="month-picker"><button type="button" class="button white" id="monthToggle" aria-expanded="false">${icon("calendar_month")} <span>${monthLabel(month)}</span> ${icon("expand_more")}</button>
    <div class="month-popover hidden" id="monthPopover"><div class="month-year"><button type="button" data-year="-1" aria-label="Năm trước">${icon("chevron_left")}</button><strong id="pickerYear">${year}</strong><button type="button" data-year="1" aria-label="Năm sau">${icon("chevron_right")}</button></div>
    <div class="month-grid">${Array.from({ length: 12 }, (_, i) => `<button type="button" data-month="${i + 1}" class="${i + 1 === current ? "active" : ""}">Tháng ${i + 1}</button>`).join("")}</div></div></div>`;
}
function metric(glyph, label, value, kind, foot, scope) {
  const calm = kind === "overdue" && value === 0,
    warning = kind === "overdue" && value > 0;
  return `<button type="button" class="card metric-card ${warning ? "danger" : ""}" data-metric="${kind}" aria-label="${label}: ${money(value)}. Xem chi tiết">
    <div class="metric-top"><span class="metric-icon ${warning ? "red" : calm || kind === "cash" ? "green" : kind === "debt" ? "amber" : ""}">${icon(glyph)}</span><span class="metric-trend">${esc(scope)}</span></div>
    <div class="metric-label">${esc(label)}</div><div class="metric mono ${warning ? "red" : ""}">${money(value)}</div>
    <div class="metric-bottom"><span>${esc(foot)}</span></div></button>`;
}
function trend(value, previous) {
  if (!previous) return value ? "Mới phát sinh" : "Chưa có kỳ trước";
  const rate = Math.round((value - previous) / previous * 100);
  return `${rate >= 0 ? "↗" : "↘"} ${Math.abs(rate)}%`;
}
function relativeDue(date) {
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
export async function render() {
  const d = await api["reports.dashboard"](`${month}-15`);
  const previous = d.chart.at(-2) || { revenue: 0, collected: 0 };
  const metrics = [
    metric(
      "payments",
      "Doanh thu tháng",
      d.revenue,
      "revenue",
      `Tháng trước: ${money(previous.revenue)} · ${d.invoices} hóa đơn`,
      trend(d.revenue, previous.revenue),
    ),
    metric(
      "account_balance_wallet",
      "Tiền thu trong tháng",
      d.collected,
      "cash",
      `Đã thu ${d.collectionRate}% giá trị hóa đơn tháng`,
      trend(d.collected, previous.collected),
    ),
    metric(
      "receipt_long",
      "Tổng công nợ hiện tại",
      d.debt,
      "debt",
      `${d.openCount} hóa đơn còn dư nợ`,
      `${d.top.length} đối tác`,
    ),
    metric(
      "warning",
      "Nợ quá hạn cần thu",
      d.overdue,
      "overdue",
      d.overdue ? `${Math.round(d.overdue / d.debt * 100)}% tổng dư nợ` : "Không có nợ quá hạn",
      d.overdue ? `${d.overdueCount} cần xử lý` : "Đã xử lý",
    ),
  ].join("");
  const top = d.top.length
    ? d.top
        .map(
          (c, i) =>
            `<button type="button" class="debtor-row" data-customer="${c.id}"><span class="debtor-line"><strong>${i + 1}. ${esc(displayName(c.name))}</strong><strong class="${c.overdueBalance ? "red" : ""} mono">${money(c.balance)}</strong></span><span class="debtor-meta"><span>${c.overdueBalance ? `Quá hạn ${money(c.overdueBalance)}` : esc(c.code)}</span><span>${d.debt ? Math.round(c.balance / d.debt * 100) : 0}%</span></span><span class="debtor-track"><span style="width:${d.debt ? Math.min(100, c.balance / d.debt * 100) : 0}%;background:${c.overdueBalance ? "#dc2626" : "#f59e0b"}"></span></span></button>`,
        )
        .join("")
    : empty("Chưa có khách hàng đang nợ");
  const due = d.due.length
    ? d.due
        .slice(0, 3)
        .map(
          (
            i,
          ) => `<div class="due-row ${i.status === "overdue" ? "overdue" : ""}"><span class="due-symbol">${icon(i.status === "overdue" ? "priority_high" : "description")}</span><button type="button" class="due-main" data-invoice="${esc(i.id)}"><strong>${esc(i.id)} <span>${esc(displayName(i.customer_name))}</span></strong><span class="small muted">Hạn ${dateText(i.due_date)} · ${relativeDue(i.due_date)} · Còn ${money(i.balance)}</span></button>
    <div class="due-actions">${button("Xem", `view:${i.id}`, "compact white")}${button("In / PDF", `print:${i.id}`, "compact white")}${button("Nhắc", `remind:${i.id}`, "compact white")}${button("Thu tiền", `collect:${i.id}`, "compact primary")}</div></div>`,
        )
        .join("")
    : empty("Chưa có hóa đơn cần xử lý");
  const activity = d.activity.length
    ? d.activity.map(activityRow).join("")
    : empty("Chưa có hoạt động");
  return `<div class="page-head dashboard-head"><div><h1>Tổng quan</h1><p class="subtitle">Tình hình kinh doanh và dòng tiền</p></div><div class="page-actions">${monthPicker()}${button("Tháng này", "thisMonth", "white")}${button(`${icon("picture_as_pdf")} PDF`, "exportPdf", "white", 'title="Xuất báo cáo tháng ra PDF"')}${button(`${icon("table_view")} Excel`, "exportExcel", "white", 'title="Xuất báo cáo tháng ra Excel"')}${button(`${icon("add")} Tạo hóa đơn`, "newInvoice", "primary")}</div></div>
    <div class="grid4 dashboard-metrics">${metrics}</div><div class="grid3 mt16 dashboard-panels"><section class="card col2 chart-card"><div class="card-head"><div><h2>Doanh thu & tiền thu 12 tháng</h2><p class="subtitle">Theo dõi dòng tiền từ 12 tháng đến ${monthLabel(month)}</p></div><div class="chart-legend"><span class="legend-revenue"></span> Doanh thu <span class="legend-cash"></span> Tiền thu</div></div>${revenueChart(d.chart)}<div class="chart-footer"><span>${icon("check_circle")} Tỷ lệ thu hồi lũy kế: <strong>${d.allCollectionRate}%</strong></span>${button("Xem báo cáo chi tiết →", "reports", "white")}</div></section><section class="card debt-card"><div class="card-head"><div><h2>Khách nợ nhiều nhất</h2><p class="subtitle">Top 5 đối tác cần theo dõi sát</p></div>${icon("group")}</div>${top}${button("Xem phân tích sổ nợ chi tiết →", "debts", "w100 white")}</section></div>
    <div class="grid3 mt16 dashboard-panels"><section class="card col2 due-card"><div class="card-head"><h2>Hóa đơn sắp đến hạn và cần xử lý</h2><span class="metric-scope">Toàn thời gian</span></div>${due}${button("Xem tất cả hóa đơn →", "invoices", "w100 white")}</section><section class="card activity-card"><div class="card-head"><h2>Hoạt động gần đây</h2></div>${activity}${button("Xem tất cả hoạt động →", "activity", "w100 white")}</section></div>`;
}
export function bind(root, ctx) {
  const popover = root.querySelector("#monthPopover"),
    toggle = root.querySelector("#monthToggle");
  toggle.addEventListener("click", () => {
    popover.classList.toggle("hidden");
    toggle.setAttribute(
      "aria-expanded",
      String(!popover.classList.contains("hidden")),
    );
  });
  document.addEventListener("click", function close(event) {
    if (!root.isConnected) {
      document.removeEventListener("click", close);
      return;
    }
    if (!event.target.closest(".month-picker")) {
      popover.classList.add("hidden");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
  root.addEventListener("click", async (e) => {
    const yearShift = e.target.closest("[data-year]");
    if (yearShift) {
      const label = root.querySelector("#pickerYear");
      label.textContent = Math.min(
        9999,
        Math.max(1, Number(label.textContent) + Number(yearShift.dataset.year)),
      );
      return;
    }
    const pick = e.target.closest("[data-month]");
    if (pick) {
      month = `${root.querySelector("#pickerYear").textContent.padStart(4, "0")}-${String(pick.dataset.month).padStart(2, "0")}`;
      ctx.refresh();
      return;
    }
    const customer = e.target.closest("[data-customer]");
    if (customer) {
      ctx.navigate("customerProfile", {
        id: Number(customer.dataset.customer),
      });
      return;
    }
    const invoice = e.target.closest("[data-invoice]");
    if (invoice) {
      ctx.navigate("invoices", { openId: invoice.dataset.invoice });
      return;
    }
    const metric = e.target.closest("[data-metric]");
    if (metric) {
      if (metric.dataset.metric === "revenue")
        ctx.navigate("reportDetail", { month });
      else if (metric.dataset.metric === "cash")
        ctx.navigate("payments", { from: `${month}-01`, to: `${month}-31` });
      else
        ctx.navigate("debts", {
          filter: metric.dataset.metric === "overdue" ? "overdue" : "all",
        });
      return;
    }
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    try {
      if (action === "thisMonth") {
        month = today().slice(0, 7);
        ctx.refresh();
      }
      if (action === "newInvoice") ctx.navigate("invoiceForm");
      if (action === "invoices") ctx.navigate("invoices", { reset: true });
      if (action === "reports")
        ctx.navigate("reports", { year: Number(month.slice(0, 4)) });
      if (["debts", "activity"].includes(action)) ctx.navigate(action);
      if (action === "exportPdf")
        ctx.toast(
          `Đã xuất ${await api["exports.pdf"]({ kind: "report", filter: { month } })}`,
        );
      if (action === "exportExcel")
        ctx.toast(
          `Đã xuất ${await api["exports.excel"]({ reportMonth: month })}`,
        );
      if (action.startsWith("view:"))
        ctx.navigate("invoices", { openId: action.slice(5) });
      if (action.startsWith("collect:"))
        ctx.navigate("payments", { invoiceId: action.slice(8), open: true });
      if (action.startsWith("print:"))
        ctx.toast(
          `Đã xuất ${await api["exports.pdf"]({ kind: "invoice", filter: { id: action.slice(6) } })}`,
        );
      if (action.startsWith("remind:")) {
        const id = action.slice(7),
          bill = await api["invoices.get"](id);
        await api["reminders.copy"](
          `Kính gửi ${bill.customer_name}, hóa đơn ${id} còn ${money(bill.balance)}, hạn thanh toán ${dateText(bill.due_date)}. Xin vui lòng kiểm tra và thanh toán. Trân trọng.`,
        );
        ctx.toast("Đã sao chép lời nhắc thanh toán.");
      }
    } catch (error) {
      ctx.toast(error.message, true);
    }
  });
}
