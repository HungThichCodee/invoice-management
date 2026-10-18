import { esc, icon, button } from "../ui.js";
const labels = {
  invoices: "Hóa đơn",
  details: "Chi tiết",
  payments: "Phiếu thu",
  customers: "Khách hàng",
  vehicles: "Xe",
  parts: "Phụ tùng",
};
const fields = [
  ["Hạn thanh toán", "due"],
  ["Ngày hóa đơn", "date"],
  ["Ngày thu", "date"],
  ["Số lượng", "qty"],
  ["Đơn giá", "price"],
  ["Trọng tải", "capacity"],
  ["Số giờ", "hours"],
  ["Tổng tiền", "total"],
  ["Thuế", "taxRate"],
  ["Chiết khấu", "discount"],
  ["Số tiền", "amount"],
  ["số điện thoại", "phone"],
];
export function issueStats(preview) {
  if (!preview) return { valid: 0, warnings: 0, errors: 0, errorRows: 0 };
  const bad = new Set(
    preview.issues
      .filter((x) => x.severity !== "warning")
      .map((x) => `${x.sheet}:${x.line}`),
  );
  const warned = new Set(
    preview.issues
      .filter((x) => x.severity === "warning")
      .map((x) => `${x.sheet}:${x.line}`),
  );
  const total = Object.values(preview.counts).reduce(
    (sum, count) => sum + count,
    0,
  );
  return {
    valid: Math.max(0, total - new Set([...bad, ...warned]).size),
    warnings: warned.size,
    errors: preview.issues.filter((x) => x.severity !== "warning").length,
    errorRows: bad.size,
  };
}
export function statusCards(preview) {
  const stats = issueStats(preview);
  return `<div class="import-status"><div class="import-status-card good"><small>HỢP LỆ</small><strong>${stats.valid} dòng</strong><span>Đủ điều kiện nhập dữ liệu</span>${icon("check_circle")}</div>
    <div class="import-status-card caution"><small>CẢNH BÁO</small><strong>${stats.warnings} dòng</strong><span>Có thể bổ sung sau</span>${icon("warning")}</div>
    <div class="import-status-card bad"><small>PHÁT HIỆN LỖI</small><strong>${stats.errorRows} dòng</strong><span>Cần sửa hoặc bỏ qua</span>${icon("cancel")}</div></div>
    <p class="import-counts">${
      Object.entries(preview.counts)
        .filter(([, count]) => count)
        .map(
          ([key, count]) =>
            `${esc(labels[key] || key)}: <strong>${count}</strong>`,
        )
        .join(" · ") || "Không có dòng dữ liệu"
    }</p>`;
}
export function issueRows(preview) {
  return preview.issues
    .map((issue) => {
      const group = Object.values(preview.groups).find((rows) =>
        rows.some(
          (row) => row._sheet === issue.sheet && row._line === issue.line,
        ),
      );
      const row = group?.find(
        (item) => item._sheet === issue.sheet && item._line === issue.line,
      );
      const match = fields.find(([label]) => issue.message.includes(label));
      const value = match && row ? row[match[1]] : "";
      const edit = row
        ? button(
            `${icon("edit")} Sửa dòng`,
            `edit:${issue.sheet}:${issue.line}`,
            "compact",
          )
        : "";
      return `<tr><td><strong>Dòng ${esc(issue.line)}</strong><small>${esc(issue.sheet || "File")}</small></td><td>${esc(match?.[0] || "Dữ liệu")}</td><td class="import-value">${esc(value === "" || value === undefined ? "—" : value)}</td><td class="${issue.severity === "warning" ? "amber" : "red"}">${icon(issue.severity === "warning" ? "warning" : "error")} ${esc(issue.message)}</td><td>${edit}</td></tr>`;
    })
    .join("");
}
