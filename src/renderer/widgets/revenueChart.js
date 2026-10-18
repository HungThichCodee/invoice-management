import { esc, money } from "../ui.js";

const compact = (value) =>
  value >= 1000000000
    ? `${(value / 1000000000).toFixed(1)} tỷ`
    : value >= 1000000
      ? `${(value / 1000000).toFixed(0)} tr`
      : value >= 1000
        ? `${(value / 1000).toFixed(0)} k`
        : String(value);
const labelFor = (period, mode) =>
  mode === "year"
    ? String(period)
    : mode === "day"
      ? `${Number(String(period).slice(8))}/${String(period).slice(5, 7)}`
      : `T${Number(String(period).slice(5))}/${String(period).slice(2, 4)}`;

export function revenueChart(rows, mode = "month") {
  const max = Math.max(
    0,
    ...rows.flatMap((r) =>
      mode === "year"
        ? [r.revenue, r.collected, r.closingDebt]
        : [r.revenue, r.collected],
    ),
  );
  const magnitude = max ? 10 ** Math.floor(Math.log10(max)) : 1;
  const ceiling = max ? Math.ceil(max / magnitude) * magnitude : 0;
  const bars = rows
    .map((row, index) => {
      const label = labelFor(row.period, mode);
      const columns = [
        ["revenue", row.revenue],
        ["cash", row.collected],
        ...(mode === "year" ? [["debt", row.closingDebt]] : []),
      ]
        .map(([kind, value]) => {
          if (!value) return '<span class="bar-slot"></span>';
          const height = Math.max(3, (value / ceiling) * 100);
          return `<span class="bar-slot"><span class="bar-value" style="bottom:calc(${height}% + 3px)">${compact(value)}</span><span class="bar ${kind}" style="height:${height}%"></span></span>`;
        })
        .join("");
      const visible =
        mode !== "day" ||
        index === 0 ||
        index === rows.length - 1 ||
        (index + 1) % 5 === 0;
      return `<div class="bar-group" title="${esc(label)}: doanh thu ${money(row.revenue)}, tiền thu ${money(row.collected)}" aria-label="${esc(label)}: doanh thu ${money(row.revenue)}, tiền thu ${money(row.collected)}">${columns}<span class="bar-label">${visible ? esc(label) : ""}</span></div>`;
    })
    .join("");
  const note =
    mode === "month" &&
    rows.slice(0, -1).every((r) => !r.revenue && !r.collected)
      ? '<p class="chart-note">Chưa có dữ liệu các tháng trước.</p>'
      : "";
  return `<div class="chart-wrap"><div class="chart-axis"><span>${ceiling ? compact(ceiling) : ""}</span><span>${ceiling ? compact(ceiling / 2) : ""}</span><span>0</span></div><div class="chart-plot ${mode === "day" ? "daily" : ""}">${bars}</div></div>${note}`;
}
