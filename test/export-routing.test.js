"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ExcelJS = require("exceljs");
const { Store } = require("../src/main/db");
const customers = require("../src/main/services/customers");
const invoices = require("../src/main/services/invoices");
const payments = require("../src/main/services/payments");
const exporter = require("../src/main/services/exports");
const settings = require("../src/main/services/settings");
const logo = require("../src/main/services/logo");

async function fixture(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hoadon-export-test-"));
  const store = new Store(dir);
  try {
    await fn(store);
  } finally {
    store.close();
    if (!path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep))
      throw Error("Unsafe test path");
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
function bill(store, customerId, date, due, price) {
  return invoices.create(store, {
    customerId,
    date,
    due,
    items: [{ name: "Thuê xe", qty: 1, price }],
  });
}
async function workbook(file) {
  const result = new ExcelJS.Workbook();
  await result.xlsx.readFile(file);
  return result;
}

test("report Excel contains period figures and import template contains headers only", () =>
  fixture(async (store) => {
    const customer = customers.create(store, { name: "Khách báo cáo" });
    const invoice = bill(
      store,
      customer.id,
      "2026-10-01",
      "2026-10-30",
      2000000,
    );
    payments.create(store, {
      invoiceId: invoice.id,
      date: "2026-10-05",
      amount: 500000,
      method: "bank",
    });
    const report = await workbook(
      await exporter.excel(store, { reportYear: 2026, reportMode: "month" }),
    );
    assert.deepEqual(
      report.worksheets.map((sheet) => sheet.name),
      ["Báo cáo"],
    );
    const october = report.worksheets[0].getRow(11).values.slice(1);
    assert.deepEqual(october, ["Tháng 10/2026", 1, 2000000, 500000, 1500000]);
    const template = await workbook(
      await exporter.excel(store, { kind: "template" }),
    );
    assert.equal(template.worksheets.length, 6);
    assert.ok(template.worksheets.every((sheet) => sheet.rowCount === 1));
  }));

test("list exports follow the selected view and PDFs use the right title", () =>
  fixture(async (store) => {
    const first = customers.create(store, { name: "Khách còn nợ" });
    const second = customers.create(store, { name: "Khách đã trả" });
    const overdue = bill(store, first.id, "2020-01-01", "2020-02-01", 1000000);
    const paid = bill(store, second.id, "2026-10-01", "2099-01-01", 2000000);
    const receiptId = payments.create(store, {
      invoiceId: paid.id,
      date: "2026-10-05",
      amount: 2000000,
      method: "cash",
    });
    const receiptPdf = exporter.printHtml(store, "receipt", { id: receiptId });
    assert.match(receiptPdf, new RegExp(`Phiếu thu ${receiptId}`));
    assert.match(receiptPdf, /Khách đã trả/);
    assert.match(receiptPdf, /2\.000\.000 ₫/);
    assert.ok(!receiptPdf.includes("Mặt hàng"));
    assert.throws(() => exporter.printHtml(store, "receipt", { id: "PT-INVALID" }), /Không tìm thấy phiếu thu/);
    assert.deepEqual(
      invoices.list(store, { status: "open" }).map((row) => row.id),
      [overdue.id],
    );
    const chosen = await workbook(
      await exporter.excel(store, {
        kind: "invoices",
        filter: { ids: [paid.id] },
      }),
    );
    assert.equal(chosen.worksheets[0].rowCount, 2);
    assert.equal(chosen.worksheets[0].getRow(2).getCell(1).value, paid.id);
    const debt = await workbook(
      await exporter.excel(store, {
        kind: "debts",
        filter: { status: "overdue" },
      }),
    );
    assert.equal(debt.worksheets[0].rowCount, 2);
    assert.equal(debt.worksheets[0].getRow(2).getCell(1).value, overdue.id);
    const clients = await workbook(
      await exporter.excel(store, {
        kind: "customers",
        filter: { status: "debt" },
      }),
    );
    assert.equal(clients.worksheets[0].rowCount, 2);
    assert.equal(
      clients.worksheets[0].getRow(2).getCell(2).value,
      "Khách còn nợ",
    );
    const selectedClient = await workbook(
      await exporter.excel(store, {
        kind: "customers",
        filter: { ids: [second.id] },
      }),
    );
    assert.equal(selectedClient.worksheets[0].rowCount, 2);
    assert.equal(
      selectedClient.worksheets[0].getRow(2).getCell(2).value,
      "Khách đã trả",
    );
    const receipts = await workbook(
      await exporter.excel(store, {
        kind: "payments",
        filter: { from: "2026-10-01", to: "2026-10-31" },
      }),
    );
    assert.deepEqual(
      receipts.worksheets.map((sheet) => sheet.name),
      ["Phiếu thu"],
    );
    assert.equal(receipts.worksheets[0].rowCount, 2);
    assert.match(
      exporter.printHtml(store, "payments", {}),
      /Danh sách phiếu thu/,
    );
    assert.match(
      exporter.printHtml(store, "report", { year: 2026, mode: "month" }),
      /Báo cáo theo tháng năm 2026/,
    );
    const debtPdf = exporter.printHtml(store, "debts", { status: "overdue" });
    assert.match(debtPdf, /Đối chiếu công nợ/);
    assert.ok(debtPdf.includes(overdue.id) && !debtPdf.includes(paid.id));
    assert.ok(
      !exporter
        .printHtml(store, "debts", { customerId: second.id })
        .includes(overdue.id),
    );
  }));

test("invoice PDF uses seller logo, tax details and footer note", () =>
  fixture(async (store) => {
    const customer = customers.create(store, { name: "Khách in hóa đơn" });
    const invoice = bill(store, customer.id, "2026-10-01", "2026-10-30", 1000000);
    const image = path.join(store.folder, "brand.png");
    fs.writeFileSync(image, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6m4QAAAAASUVORK5CYII=", "base64"));
    logo.save(store, image);
    settings.update(store, { sellerTaxId: "0123456789", sellerEmail: "shop@example.vn", sellerBank: "Tài khoản 123", sellerNote: "Cảm ơn & hẹn gặp lại" });
    const html = exporter.printHtml(store, "invoice", { id: invoice.id });
    assert.match(html, /data:image\/png;base64,/);
    assert.match(html, /MST: 0123456789/);
    assert.match(html, /shop@example.vn/);
    assert.match(html, /Tài khoản 123/);
    assert.match(html, /Cảm ơn &amp; hẹn gặp lại/);
    logo.remove(store);
    assert.ok(!exporter.printHtml(store, "invoice", { id: invoice.id }).includes("data:image/png"));
  }));
