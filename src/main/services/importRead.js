"use strict";
const path = require("node:path");
const ExcelJS = require("exceljs");
const { fail } = require("./validate");
const label = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
const aliases = {
  code: ["mahd", "mahoadon", "invoiceid"],
  date: ["ngay", "ngaylap", "ngayhoadon", "ngaythu", "date"],
  due: ["hantra", "hanthanhtoan", "due"],
  customer: ["khachhang", "tenkhach", "ten"],
  customerCode: ["makhach", "makh"],
  phone: ["dienthoai", "sodienthoai", "sdt"],
  address: ["diachi"],
  total: ["tongtien", "thanhtien", "total"],
  taxRate: ["thue", "thuegtgt", "thue"],
  discount: ["chietkhau", "giamgia"],
  name: ["mathang", "tenhang", "tendichvu", "ten", "name"],
  qty: ["soluong", "sl", "qty"],
  price: ["dongia", "gia", "price"],
  amount: ["sotien", "amount"],
  invoice: ["mahd", "mahoadon", "invoiceid"],
  method: ["phuongthuc", "hinhthuc"],
  unit: ["dvt", "donvi"],
  kind: ["loai"],
  model: ["model"],
  serial: ["serial", "bienso"],
  capacity: ["trongtaikg", "trongtai"],
  hours: ["sogio", "giolamviec"],
};
function cell(value) {
  if (value && typeof value === "object") {
    if (value.text) return value.text;
    if (value.result !== undefined) return value.result;
    if (value.richText) return value.richText.map((x) => x.text).join("");
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value ?? "";
}
function sheetRows(sheet) {
  if (!sheet.rowCount) return [];
  const headers = sheet.getRow(1).values.slice(1).map(cell).map(label);
  const rows = [];
  for (let line = 2; line <= sheet.rowCount; line++) {
    const row = sheet.getRow(line).values.slice(1).map(cell);
    if (row.every((x) => x === "")) continue;
    const obj = { _line: line };
    for (const [key, names] of Object.entries(aliases)) {
      const index = headers.findIndex((h) => names.includes(h));
      obj[key] = index < 0 ? "" : row[index];
    }
    rows.push(obj);
  }
  return rows;
}
async function read(file) {
  const workbook = new ExcelJS.Workbook();
  const ext = path.extname(file).toLowerCase();
  if (ext === ".xlsx") await workbook.xlsx.readFile(file);
  else if (ext === ".csv") await workbook.csv.readFile(file);
  else fail("Chỉ hỗ trợ file .xlsx hoặc .csv.");
  return workbook.worksheets.map((s) => ({ name: s.name, rows: sheetRows(s) }));
}
function classify(name, single) {
  const key = label(name);
  if (key.includes("chitiet")) return "details";
  if (key.includes("thutien") || key.includes("phieuthu")) return "payments";
  if (key.includes("khach")) return "customers";
  if (key.includes("phutung")) return "parts";
  if (key === "xe" || key.includes("xenang")) return "vehicles";
  if (key.includes("hoadon") || single) return "invoices";
  return null;
}
module.exports = { read, classify };
