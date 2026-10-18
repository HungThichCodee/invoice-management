"use strict";
const fs = require("node:fs");
const { safe, rows, file } = require("./exportShared");
function csvData(columns, data) {
  const quote = (x) => `"${safe(x).replace(/"/g, '""')}"`;
  return (
    "\uFEFF" +
    [columns, ...data].map((r) => r.map(quote).join(",")).join("\r\n")
  );
}
function csv(store, kind, filter = {}) {
  const data = rows(store, filter);
  const config = {
    invoices: [
      [
        "Mã HĐ",
        "Ngày",
        "Hạn trả",
        "Mã khách",
        "Khách hàng",
        "Tổng tiền",
        "Đã thu",
        "Còn nợ",
      ],
      data.bills.map((i) => [
        i.id,
        i.invoice_date,
        i.due_date,
        i.customer_code,
        i.customer_name,
        i.total,
        i.paid,
        i.balance,
      ]),
    ],
    payments: [
      ["Mã phiếu", "Mã HĐ", "Ngày thu", "Số tiền", "Phương thức", "Ghi chú"],
      data.receipts.map((p) => [
        p.id,
        p.invoice_id,
        p.pay_date,
        p.amount,
        p.method,
        p.note,
      ]),
    ],
    customers: [
      ["Mã khách", "Tên", "Điện thoại", "Địa chỉ", "Công nợ"],
      data.clients.map((c) => [c.code, c.name, c.phone, c.address, c.balance]),
    ],
  }[kind || "invoices"];
  if (!config) throw Error("Loại CSV không hợp lệ.");
  const target = file(store, `Xuat_${kind}`, "csv");
  fs.writeFileSync(target, csvData(...config), "utf8");
  return target;
}
module.exports = { csv, csvData };
