import { esc, money, button, empty, icon } from "../ui.js";

const sum = (rows, field) => rows.reduce((value, row) => value + row[field], 0);
const rate = (billed, paid) =>
  billed ? Math.min(100, Math.round((paid / billed) * 100)) : 0;

export function reportCards(rows, mode, year, customerCount = 0) {
  const focus = mode === "year" ? rows.at(-1) : null;
  const revenue = focus ? focus.revenue : sum(rows, "revenue");
  const collected = focus ? focus.collected : sum(rows, "collected");
  const debt = rows.at(-1)?.closingDebt || 0;
  const count = focus ? focus.invoices : sum(rows, "invoices");
  const values =
    mode === "month"
      ? [
          ["payments", "Doanh thu lũy kế", revenue, "blue", `Năm ${year}`],
          [
            "account_balance_wallet",
            "Tiền thu thực tế",
            collected,
            "green",
            "Theo ngày phiếu thu",
          ],
          ["pending_actions", "Nợ cuối kỳ", debt, "red", "Số dư tại cuối kỳ"],
          [
            "percent",
            "Tỷ lệ thu hồi nợ",
            `${rate(revenue, collected)}%`,
            "green",
            "Tiền thu / doanh thu",
          ],
          [
            "receipt_long",
            "Tổng số hóa đơn",
            count,
            "",
            `${rows.filter((r) => r.invoices).length} tháng phát sinh`,
          ],
        ]
      : [
          [
            "payments",
            `Doanh thu năm ${year}`,
            revenue,
            "blue",
            "Theo ngày lập hóa đơn",
          ],
          [
            "trending_up",
            "Tăng trưởng so năm trước",
            rows.at(-2)?.revenue
              ? `${Math.round((revenue / rows.at(-2).revenue - 1) * 100)}%`
              : "—",
            "green",
            "So với năm trước",
          ],
          [
            "percent",
            "Tỷ lệ thu hồi năm",
            `${rate(revenue, collected)}%`,
            "green",
            "Tiền thu trong năm",
          ],
          [
            "groups",
            "Tổng đối tác tích lũy",
            customerCount,
            "",
            `Có ${count} hóa đơn trong năm`,
          ],
        ];
  return `<div class="report-overview-kpis">${values.map(([symbol, label, value, color, note]) => `<div class="card report-overview-card"><div class="metric-icon ${color}">${icon(symbol)}</div><div class="metric-label">${esc(label)}</div><div class="metric ${color}">${typeof value === "number" && ["payments", "account_balance_wallet", "pending_actions"].includes(symbol) ? money(value) : esc(value)}</div><div class="report-card-note">${esc(note)}</div></div>`).join("")}</div>`;
}

export function reportHighlight(row, year) {
  if (!row) return "";
  return `<div class="report-highlight"><strong>Tháng ${Number(row.period.slice(5))}/${year}</strong><span>Doanh thu: <b class="blue">${money(row.revenue)}</b></span><span>Tiền thu: <b class="green">${money(row.collected)}</b></span><span>Nợ cuối kỳ: <b class="red">${money(row.closingDebt)}</b></span></div>`;
}

export function reportTable(rows, mode) {
  const body = rows
    .map((row) => {
      const label =
        mode === "month"
          ? `Tháng ${Number(row.period.slice(5))}/${row.period.slice(0, 4)}`
          : row.period;
      const percentage = rate(row.revenue, row.collected);
      return `<tr><td>${mode === "month" ? `<a href="#" class="blue strong" data-period="${esc(row.period)}">${esc(label)}</a>` : `<strong>${esc(label)}</strong>`}</td><td class="right">${row.invoices}</td><td class="right strong">${money(row.revenue)}</td><td class="right green">${money(row.collected)}</td><td class="right ${row.closingDebt ? "red" : "muted"}">${money(row.closingDebt)}</td><td class="report-rate"><strong>${percentage}%</strong><span class="report-rate-track"><i style="width:${percentage}%"></i></span></td><td>${mode === "month" ? button("Chi tiết ›", `detail:${row.period}`, "compact") : button("Xem tháng ›", `year:${row.period}`, "compact")}</td></tr>`;
    })
    .join("");
  const totalRevenue = sum(rows, "revenue"),
    totalCollected = sum(rows, "collected");
  return `<div class="table-wrap"><table><thead><tr><th>Kỳ</th><th class="right">Hóa đơn</th><th class="right">Doanh thu</th><th class="right">Tiền thu trong kỳ</th><th class="right">Nợ cuối kỳ</th><th>Tỷ lệ thu</th><th>Thao tác</th></tr></thead><tbody>${body || `<tr><td colspan="7">${empty("Không tìm thấy kỳ báo cáo")}</td></tr>`}</tbody>${rows.length ? `<tfoot><tr><td>Tổng kỳ hiển thị</td><td class="right">${sum(rows, "invoices")}</td><td class="right blue">${money(totalRevenue)}</td><td class="right green">${money(totalCollected)}</td><td class="right red">${money(rows[0].closingDebt)}</td><td>${rate(totalRevenue, totalCollected)}%</td><td></td></tr></tfoot>` : ""}</table></div>`;
}
