"use strict";
const invoices = require("./invoices");
const payments = require("./payments");
const customers = require("./customers");
const reports = require("./reports");
const settings = require("./settings");
const logo = require("./logo");
const { shortDate, reportMonth } = require("./exportShared");
const { debtRows } = require("./exportSheet");
function printHtml(store, kind, filter = {}) {
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (x) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[x],
    );
  const dong = (n) =>
    `${new Intl.NumberFormat("vi-VN").format(Number(n || 0))} ₫`;
  let title = "Bảng kê hóa đơn",
    headers,
    data,
    detail = "",
    footer = "";
  const seller = settings.get(store);
  if (kind === "receipt") {
    const receipt = payments.list(store).find((row) => row.id === filter.id);
    if (!receipt) throw Error("Không tìm thấy phiếu thu.");
    title = `Phiếu thu ${receipt.id}`;
    const methods = { cash: "Tiền mặt", bank: "Chuyển khoản", other: "Khác" };
    detail = `<div class="columns"><div><strong>Đơn vị thu:</strong> ${esc(seller.sellerName || "Xe Nâng Minh Phát")}<br>${esc(seller.sellerAddress || "")}<br>${esc(seller.sellerPhone || "")}</div><div><strong>Ngày thu:</strong> ${shortDate(receipt.pay_date)}</div></div>`;
    headers = ["Nội dung", "Thông tin"];
    data = [
      ["Khách hàng", receipt.customer_name],
      ["Hóa đơn", receipt.invoice_id],
      ["Số tiền", dong(receipt.amount)],
      ["Phương thức", methods[receipt.method]],
      ["Ghi chú", receipt.note || "—"],
    ];
    footer =
      '<div class="receipt-signatures"><div>Người nộp tiền<br><small>(Ký, ghi rõ họ tên)</small></div><div>Người lập phiếu<br><small>(Ký, ghi rõ họ tên)</small></div></div>';
  } else if (kind === "invoice") {
    const i = invoices.get(store, filter.id);
    title = `Hóa đơn ${i.id}`;
    const c = customers.get(store, i.customer_id),
      picture = logo.dataUrl(store, seller.sellerLogo);
    detail = `<div class="columns"><div class="seller-block">${picture ? `<img class="seller-logo" src="${picture}" alt="Logo đơn vị">` : ""}<div><strong>Đơn vị bán:</strong> ${esc(seller.sellerName || "Xe Nâng Minh Phát")}<br>${esc(seller.sellerAddress || "")}<br>${esc(seller.sellerPhone || "")}${seller.sellerTaxId ? `<br>MST: ${esc(seller.sellerTaxId)}` : ""}${seller.sellerEmail ? `<br>Email: ${esc(seller.sellerEmail)}` : ""}${seller.sellerBank ? `<br>Ngân hàng: ${esc(seller.sellerBank)}` : ""}</div></div><div><strong>Khách hàng:</strong> ${esc(c.name)}<br>${esc(c.address)}<br>${esc(c.phone)}</div></div><p>Ngày lập: ${shortDate(i.invoice_date)} · Hạn thanh toán: ${shortDate(i.due_date)}</p>`;
    if (seller.sellerNote)
      footer = `<p class="footer-note">${esc(seller.sellerNote)}</p>`;
    headers = ["Mặt hàng", "Số lượng", "Đơn giá", "Thành tiền"];
    data = i.items.map((r) => [r.name, r.qty, dong(r.price), dong(r.amount)]);
    data.push(
      ["Tiền hàng", "", "", dong(i.subtotal)],
      ["Thuế GTGT", "", "", dong(Math.round((i.subtotal * i.tax_rate) / 100))],
      ["Chiết khấu", "", "", dong(i.discount)],
      ["Tổng tiền", "", "", dong(i.total)],
      ["Đã thu", "", "", dong(i.paid)],
      ["Còn nợ", "", "", dong(i.balance)],
    );
  } else if (kind === "payments") {
    title = "Danh sách phiếu thu";
    headers = ["Mã phiếu", "Hóa đơn", "Ngày", "Số tiền"];
    data = payments
      .list(store, filter)
      .map((r) => [r.id, r.invoice_id, shortDate(r.pay_date), dong(r.amount)]);
  } else if (kind === "report") {
    headers = ["Kỳ", "Doanh thu", "Đã thu", "Nợ cuối kỳ"];
    if (filter.month) {
      const month = reportMonth(filter.month);
      title = `Báo cáo tháng ${Number(month.slice(5))}/${month.slice(0, 4)}`;
      data = reports
        .periods(store, Number(month.slice(0, 4)), "month")
        .filter((r) => r.period === month)
        .map((r) => [
          title,
          dong(r.revenue),
          dong(r.collected),
          dong(r.closingDebt),
        ]);
    } else {
      const year = filter.year || new Date().getFullYear(),
        mode = filter.mode === "year" ? "year" : "month";
      title =
        mode === "year"
          ? `Báo cáo theo năm đến ${year}`
          : `Báo cáo theo tháng năm ${year}`;
      data = reports
        .periods(store, year, mode)
        .map((r) => [
          mode === "month"
            ? `Tháng ${Number(r.period.slice(5))}/${r.period.slice(0, 4)}`
            : r.period,
          dong(r.revenue),
          dong(r.collected),
          dong(r.closingDebt),
        ]);
    }
  } else if (kind === "debts") {
    title = "Đối chiếu công nợ";
    headers = ["Mã HĐ", "Khách hàng", "Hạn trả", "Tổng tiền", "Còn nợ"];
    data = debtRows(store, filter).map((i) => [
      i.id,
      i.customer_name,
      shortDate(i.due_date),
      dong(i.total),
      dong(i.balance),
    ]);
  } else {
    headers = ["Mã HĐ", "Khách hàng", "Ngày", "Tổng tiền", "Còn nợ"];
    data = invoices
      .list(store, filter)
      .map((r) => [
        r.id,
        r.customer_name,
        shortDate(r.invoice_date),
        dong(r.total),
        dong(r.balance),
      ]);
  }
  return `<!doctype html><html lang="vi"><meta charset="utf-8"><style>body{font:14px Arial;margin:32px;color:#172033}h1{color:#164dc9}.columns{display:flex;justify-content:space-between;gap:30px;margin:22px 0}.seller-block{display:flex;align-items:flex-start;gap:12px}.seller-logo{width:64px;height:64px;object-fit:contain}.footer-note{margin-top:18px;padding:10px;background:#eef2ff}.receipt-signatures{display:flex;justify-content:space-around;text-align:center;margin-top:54px;font-weight:bold}.receipt-signatures small{font-weight:normal}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#eef2ff}</style><h1>${esc(title)}</h1><p>${esc(seller.sellerName || "Xe Nâng Minh Phát")} · ${shortDate(new Date().toLocaleDateString("en-CA"))}</p>${detail}<table><thead><tr>${headers.map((x) => `<th>${esc(x)}</th>`).join("")}</tr></thead><tbody>${data.map((r) => `<tr>${r.map((x) => `<td>${esc(x)}</td>`).join("")}</tr>`).join("")}</tbody></table>${footer}</html>`;
}
module.exports = { printHtml };
