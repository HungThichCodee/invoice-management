import { api, esc, icon, button } from "../ui.js";
import { revenueChart } from "../widgets/revenueChart.js";
import { reportCards, reportTable, reportHighlight } from "../widgets/reportOverview.js";
let year = new Date().getFullYear(),
  mode = "month";
let quarter = "all";
let query = "";
export async function render(_ctx, args = {}) {
  if (args.year) year = Number(args.year);
  const rows = await api["reports.periods"]({ year, mode });
  const todayPeriod = new Date().toLocaleDateString("en-CA").slice(0, 7);
  const current = rows.find((row) => row.period === todayPeriod);
  const customerCount = mode === "year" ? (await api["customers.list"]("")).length : 0;
  const shown = rows.filter((row) => {
    if (mode === "month" && row.period > todayPeriod) return false;
    if (mode === "month" && quarter !== "all" && Math.ceil(Number(row.period.slice(5)) / 3) !== Number(quarter)) return false;
    return !query || row.period.includes(query) || `tháng ${Number(row.period.slice(5))}`.includes(query.toLowerCase());
  }).reverse();
  return `<div class="reports-page"><div class="page-head reports-head"><div><p class="report-eyebrow">KỲ BÁO CÁO TÀI CHÍNH</p><h1>Báo cáo doanh thu</h1><p class="subtitle">Doanh thu theo ngày lập hóa đơn, tiền thu theo ngày phiếu thu</p></div><div class="page-actions">${button("Theo tháng", "month", mode === "month" ? "primary" : "white")}${button("Theo năm", "year", mode === "year" ? "primary" : "white")}<input id="year" class="input" aria-label="Năm báo cáo" type="number" min="0" max="9999" step="1" value="${year}">${button(`${icon("picture_as_pdf")} Xuất PDF`, "pdf")}${button(`${icon("table_view")} Xuất Excel`, "excel")}</div></div>
    ${reportCards(rows, mode, year, customerCount)}
    <section class="card report-chart mb16"><div class="card-head"><div><h2>${mode === "month" ? `Diễn biến doanh thu & tiền thu 12 tháng năm ${year}` : `Doanh thu và tiền thu các năm ${year - 2}–${year}`}</h2><p class="subtitle">Số liệu phát sinh và dòng tiền thực thu theo kỳ kế toán</p></div><div class="chart-legend"><span class="legend-revenue"></span> Doanh thu <span class="legend-cash"></span> Tiền thu ${mode === "year" ? '<span class="legend-debt"></span> Nợ cuối kỳ' : ""}</div></div>${mode === "month" ? reportHighlight(current, year) : ""}${revenueChart(rows, mode)}<div class="report-chart-footer">Đơn vị: VND · Di chuột lên cột để xem số tiền</div></section>
    <section class="card report-table"><div class="card-head"><div><h2>${mode === "month" ? "Chi tiết theo tháng" : "So sánh doanh thu theo năm"}</h2><p class="subtitle">${mode === "month" ? `Kỳ báo cáo 12 tháng năm ${year}` : `Ba năm gần nhất đến ${year}`}</p></div>${mode === "month" ? `<div class="report-filters"><div class="report-quarters">${["all", "1", "2", "3", "4"].map((v) => button(v === "all" ? "Tất cả" : `Q${v}`, `quarter:${v}`, quarter === v ? "primary compact" : "white compact")).join("")}</div><input id="reportSearch" class="input" aria-label="Tìm theo tháng" placeholder="Tìm theo tháng..." value="${esc(query)}"></div>` : ""}</div>${reportTable(shown, mode)}<div class="report-table-footer">Hiển thị ${shown.length}/${rows.length} kỳ · Số liệu tính từ hóa đơn và phiếu thu đã lưu</div></section></div>`;
}
export function bind(root, ctx) {
  root.querySelector("#year").addEventListener("change", (e) => {
    year = Number(e.target.value) || new Date().getFullYear();
    ctx.refresh();
  });
  root.querySelector("#reportSearch")?.addEventListener("change", (e) => {
    query = e.target.value.trim();
    ctx.refresh();
  });
  root.addEventListener("click", async (e) => {
    const period = e.target.closest("[data-period]");
    if (period) {
      e.preventDefault();
      if (mode === "month")
        ctx.navigate("reportDetail", { month: period.dataset.period });
      return;
    }
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    try {
      if (action === "month" || action === "year") {
        mode = action;
        ctx.refresh();
      }
      if (action.startsWith("quarter:")) {
        quarter = action.slice(8);
        ctx.refresh();
      }
      if (action.startsWith("detail:"))
        ctx.navigate("reportDetail", { month: action.slice(7) });
      if (action.startsWith("year:")) {
        year = Number(action.slice(5));
        mode = "month";
        quarter = "all";
        query = "";
        ctx.refresh();
      }
      if (action === "pdf")
        ctx.toast(
          `Đã xuất ${await api["exports.pdf"]({ kind: "report", filter: { year, mode } })}`,
        );
      if (action === "excel")
        ctx.toast(
          `Đã xuất ${await api["exports.excel"]({ reportYear: year, reportMode: mode })}`,
        );
    } catch (x) {
      ctx.toast(x.message, true);
    }
  });
}
