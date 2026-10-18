import { esc, displayName, dateTimeText, icon } from "../ui.js";
const labels = {
  invoice: {
    create: "Đã tạo hóa đơn",
    update: "Đã sửa hóa đơn",
    delete: "Đã xóa hóa đơn",
  },
  payment: {
    create: "Đã ghi phiếu thu",
    update: "Đã sửa phiếu thu",
    delete: "Đã xóa phiếu thu",
    bulk: "Đã thu gộp công nợ",
  },
  customer: {
    create: "Đã thêm khách hàng",
    update: "Đã sửa khách hàng",
    delete: "Đã xóa khách hàng",
  },
};
const glyphs = {
  invoice: "receipt_long",
  payment: "payments",
  customer: "group",
};
export function activityRow(row) {
  const label = labels[row.entity]?.[row.action] || "Đã cập nhật dữ liệu";
  const subject =
    row.entity === "customer"
      ? displayName(row.subject_name || "Khách hàng đã xóa")
      : row.action === "bulk"
        ? "Nhiều phiếu thu"
        : `${row.entity_id}${row.subject_name ? ` · ${displayName(row.subject_name)}` : ""}`;
  return `<div class="activity"><span class="activity-icon">${icon(glyphs[row.entity] || "history")}</span><div><strong>${label}</strong><div class="small muted">${esc(subject)} · ${dateTimeText(row.created_at)}</div></div></div>`;
}
