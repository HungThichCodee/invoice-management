"use strict";
const ExcelJS = require("exceljs");
const reports = require("./reports");
const { safe, shortDate, reportMonth, file, rows } = require("./exportShared");
const { addSheet, singleSheet } = require("./exportSheet");
async function excel(store, filter = {}) {
  if (filter.reportMonth) {
    const month = reportMonth(filter.reportMonth),
      detail = reports.monthDetail(store, month);
    const workbook = new ExcelJS.Workbook(),
      sheet = workbook.addWorksheet(`Tháng ${Number(month.slice(5))}`);
    sheet.addRow([
      `Báo cáo tháng ${Number(month.slice(5))}/${month.slice(0, 4)}`,
    ]);
    sheet.addRow(["Doanh thu", detail.summary.revenue]);
    sheet.addRow(["Tiền thu", detail.summary.collected]);
    sheet.addRow(["Số hóa đơn", detail.summary.invoices]);
    sheet.addRow([]);
    sheet.addRow([
      "Hóa đơn",
      "Khách hàng",
      "Ngày",
      "Tổng tiền",
      "Đã thu",
      "Còn nợ",
    ]);
    for (const bill of detail.invoices)
      sheet.addRow([
        bill.id,
        safe(bill.customer_name),
        shortDate(bill.invoice_date),
        bill.total,
        bill.paid,
        bill.balance,
      ]);
    sheet.addRow([]);
    sheet.addRow(["Phiếu thu", "Hóa đơn", "Ngày thu", "Số tiền"]);
    for (const receipt of detail.payments)
      sheet.addRow([
        receipt.id,
        receipt.invoice_id,
        shortDate(receipt.pay_date),
        receipt.amount,
      ]);
    sheet.columns.forEach((column) => {
      column.width = 23;
    });
    sheet.getRow(1).font = { bold: true, size: 15 };
    const target = file(store, `Bao_cao_${month}`, "xlsx");
    await workbook.xlsx.writeFile(target);
    return target;
  }
  if (filter.reportYear) {
    const year = Number(filter.reportYear),
      mode = filter.reportMode === "year" ? "year" : "month";
    const values = reports.periods(store, year, mode),
      workbook = new ExcelJS.Workbook();
    addSheet(
      workbook,
      "Báo cáo",
      ["Kỳ", "Số hóa đơn", "Doanh thu", "Tiền thu", "Nợ cuối kỳ"],
      values.map((r) => [
        mode === "month"
          ? `Tháng ${Number(r.period.slice(5))}/${r.period.slice(0, 4)}`
          : r.period,
        r.invoices,
        r.revenue,
        r.collected,
        r.closingDebt,
      ]),
    );
    const target = file(store, `Bao_cao_${mode}_${year}`, "xlsx");
    await workbook.xlsx.writeFile(target);
    return target;
  }
  if (["invoices", "payments", "customers", "debts"].includes(filter.kind)) {
    const target = file(store, `Xuat_${filter.kind}`, "xlsx");
    await singleSheet(store, filter).xlsx.writeFile(target);
    return target;
  }
  if (filter.kind && filter.kind !== "template")
    throw Error("Loại Excel không hợp lệ.");
  const template = filter.kind === "template",
    d = template
      ? { bills: [], details: [], receipts: [], clients: [] }
      : rows(store, filter),
    workbook = new ExcelJS.Workbook();
  const sheets = [
    [
      "Hóa đơn",
      [
        "Mã HĐ",
        "Ngày",
        "Hạn trả",
        "Mã khách",
        "Khách hàng",
        "Tổng tiền",
        "Đã thu",
        "Còn nợ",
        "Thuế %",
        "Chiết khấu",
      ],
      d.bills.map((i) => [
        i.id,
        i.invoice_date,
        i.due_date,
        i.customer_code,
        i.customer_name,
        i.total,
        i.paid,
        i.balance,
        i.tax_rate,
        i.discount,
      ]),
    ],
    [
      "Chi tiết",
      [
        "Mã HĐ",
        "Loại",
        "Tên",
        "ĐVT",
        "Số lượng",
        "Đơn giá",
        "Thành tiền",
        "Model",
        "Serial",
        "Trọng tải kg",
        "Số giờ",
      ],
      d.details,
    ],
    [
      "Thu tiền",
      ["Mã phiếu", "Mã HĐ", "Ngày thu", "Số tiền", "Phương thức", "Ghi chú"],
      d.receipts.map((p) => [
        p.id,
        p.invoice_id,
        p.pay_date,
        p.amount,
        p.method,
        p.note,
      ]),
    ],
    [
      "Khách hàng",
      ["Mã khách", "Tên", "Điện thoại", "Địa chỉ", "Công nợ"],
      d.clients.map((c) => [c.code, c.name, c.phone, c.address, c.balance]),
    ],
    [
      "Xe",
      ["Tên", "Model", "Serial", "Trọng tải kg", "Số giờ", "Giá"],
      template
        ? []
        : store
            .all(
              "SELECT name,model,serial,capacity_kg,hours_milli,price FROM catalog_items WHERE kind='vehicle'",
            )
            .map((r) => [
              r.name,
              r.model,
              r.serial,
              r.capacity_kg,
              r.hours_milli / 1000,
              r.price,
            ]),
    ],
    [
      "Phụ tùng",
      ["Tên", "Model", "Serial", "Giá"],
      template
        ? []
        : store
            .all(
              "SELECT name,model,serial,price FROM catalog_items WHERE kind='part'",
            )
            .map((r) => [r.name, r.model, r.serial, r.price]),
    ],
  ];
  for (const [name, headers, values] of sheets)
    addSheet(workbook, name, headers, values);
  const target = file(
    store,
    template ? "Mau_nhap_du_lieu" : "Xuat_toan_bo",
    "xlsx",
  );
  await workbook.xlsx.writeFile(target);
  return target;
}
module.exports = { excel };
