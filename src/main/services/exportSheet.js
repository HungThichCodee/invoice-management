"use strict";
const ExcelJS = require("exceljs");
const invoices = require("./invoices");
const payments = require("./payments");
const customers = require("./customers");
const { safe, shortDate } = require("./exportShared");
function addSheet(workbook, name, headers, values) {
  const sheet = workbook.addWorksheet(name);
  sheet.addRow(headers);
  for (const row of values)
    sheet.addRow(row.map((x) => (typeof x === "string" ? safe(x) : x)));
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((column) => {
    column.width = 23;
  });
  return sheet;
}
function debtRows(store, filter = {}) {
  const open = invoices
    .list(store, filter.customerId ? { customerId: filter.customerId } : {})
    .filter((row) => row.balance > 0);
  return filter.status === "overdue"
    ? open.filter((row) => row.status === "overdue")
    : filter.status === "soon"
      ? open.filter((row) => row.status !== "overdue")
      : open;
}
function singleSheet(store, options) {
  const workbook = new ExcelJS.Workbook(),
    filter = options.filter || {};
  if (options.kind === "invoices") {
    const values = invoices
      .list(store, filter)
      .map((i) => [
        i.id,
        shortDate(i.invoice_date),
        shortDate(i.due_date),
        i.customer_name,
        i.total,
        i.paid,
        i.balance,
        i.status,
      ]);
    addSheet(
      workbook,
      "Hóa đơn",
      [
        "Mã HĐ",
        "Ngày lập",
        "Hạn trả",
        "Khách hàng",
        "Tổng tiền",
        "Đã thu",
        "Còn nợ",
        "Trạng thái",
      ],
      values,
    );
  } else if (options.kind === "payments") {
    const values = payments
      .list(store, filter)
      .map((p) => [
        p.id,
        p.invoice_id,
        shortDate(p.pay_date),
        p.customer_name,
        p.amount,
        p.method,
        p.note,
      ]);
    addSheet(
      workbook,
      "Phiếu thu",
      [
        "Mã phiếu",
        "Mã HĐ",
        "Ngày thu",
        "Khách hàng",
        "Số tiền",
        "Phương thức",
        "Ghi chú",
      ],
      values,
    );
  } else if (options.kind === "customers") {
    let values = customers.list(store, filter.search || "");
    if (filter.ids !== undefined) {
      if (!Array.isArray(filter.ids))
        throw Error("Danh sách khách hàng không hợp lệ.");
      const ids = new Set(filter.ids.map(Number));
      values = values.filter((c) => ids.has(c.id));
    }
    if (filter.status === "debt") values = values.filter((c) => c.balance > 0);
    if (filter.status === "clear")
      values = values.filter((c) => c.balance === 0);
    addSheet(
      workbook,
      "Khách hàng",
      ["Mã khách", "Tên", "Điện thoại", "Địa chỉ", "Doanh số", "Công nợ"],
      values.map((c) => [
        c.code,
        c.name,
        c.phone,
        c.address,
        c.total,
        c.balance,
      ]),
    );
  } else if (options.kind === "debts") {
    addSheet(
      workbook,
      "Công nợ",
      [
        "Mã HĐ",
        "Khách hàng",
        "Hạn trả",
        "Tổng tiền",
        "Đã thu",
        "Còn nợ",
        "Trạng thái",
      ],
      debtRows(store, filter).map((i) => [
        i.id,
        i.customer_name,
        shortDate(i.due_date),
        i.total,
        i.paid,
        i.balance,
        i.status,
      ]),
    );
  } else throw Error("Loại Excel không hợp lệ.");
  return workbook;
}
module.exports = { addSheet, debtRows, singleSheet };
