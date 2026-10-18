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
const exportsService = require("../src/main/services/exports");
const imports = require("../src/main/services/imports");

test("Excel export imports into a new database and undo removes the batch", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hoadon-import-"));
  const source = new Store(path.join(dir, "source"));
  const target = new Store(path.join(dir, "target"));
  try {
    const c = customers.create(source, {
      name: "Khách thử",
      phone: "0901234567",
    });
    const i = invoices.create(source, {
      customerId: c.id,
      date: "2026-10-01",
      due: "2026-10-30",
      taxRate: 10,
      items: [{ name: "Bảo dưỡng", qty: 1, price: 1000000 }],
    });
    payments.create(source, {
      invoiceId: i.id,
      date: "2026-10-05",
      amount: 500000,
      method: "bank",
    });
    const file = await exportsService.excel(source);
    const sheets = await imports.read(file),
      preview = imports.preview(sheets);
    assert.deepEqual(preview.issues, []);
    const batch = await imports.commit(
      target,
      { name: path.basename(file), sheets },
      "skip",
    );
    assert.equal(batch.counts.invoices, 1);
    assert.equal(customers.list(target).length, 1);
    assert.equal(invoices.list(target)[0].total, 1100000);
    assert.equal(payments.list(target)[0].amount, 500000);
    imports.undo(target);
    assert.equal(invoices.list(target).length, 0);
    assert.equal(payments.list(target).length, 0);
  } finally {
    source.close();
    target.close();
    if (!path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep))
      throw Error("Unsafe test path");
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("preview rejects negative imported price before database write", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hoadon-negative-"));
  try {
    const file = path.join(dir, "negative.xlsx"),
      workbook = new ExcelJS.Workbook();
    const invoice = workbook.addWorksheet("Hóa đơn");
    invoice.addRows([
      ["Mã HĐ", "Ngày", "Hạn trả", "Khách hàng", "Tổng tiền"],
      ["OLD-1", "2026-10-01", "2026-10-30", "Khách thử", 100],
    ]);
    const details = workbook.addWorksheet("Chi tiết");
    details.addRows([
      ["Mã HĐ", "Tên", "Số lượng", "Đơn giá"],
      ["OLD-1", "Phụ tùng", 1, -50],
    ]);
    await workbook.xlsx.writeFile(file);
    const preview = imports.preview(await imports.read(file));
    assert.match(preview.issues[0].message, /Đơn giá/);
  } finally {
    if (!path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep))
      throw Error("Unsafe test path");
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("skip invalid rows also removes dependent details and receipts", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hoadon-skip-"));
  const store = new Store(dir);
  try {
    const session = { name: "broken.xlsx", sheets: [
      { name: "Hóa đơn", rows: [
        { _line: 2, code: "OLD-BAD", date: "2026-02-31", due: "2026-10-30", customer: "Khách A", total: 100 },
        { _line: 3, code: "OLD-GOOD", date: "2026-10-01", due: "2026-10-30", customer: "Khách B", total: 500 },
      ] },
      { name: "Chi tiết", rows: [
        { _line: 2, invoice: "OLD-BAD", name: "Hàng A", qty: 1, price: 100 },
        { _line: 3, invoice: "OLD-GOOD", name: "Hàng B", qty: 1, price: -500 },
      ] },
      { name: "Thu tiền", rows: [
        { _line: 2, invoice: "OLD-BAD", date: "2026-10-02", amount: 100 },
      ] },
    ] };
    assert.equal(imports.preview(session.sheets, store).issues.length, 2);
    const result = imports.skipInvalidRows(session, store);
    assert.equal(result.removed, 4);
    assert.deepEqual(result.issues, []);
    assert.equal(result.counts.invoices, 1);
    assert.equal(result.counts.details, 0);
    assert.equal(result.counts.payments, 0);
  } finally {
    store.close();
    if (!path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep))
      throw Error("Unsafe test path");
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("optional import warnings do not block an atomic commit", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hoadon-warning-"));
  const store = new Store(dir);
  try {
    const sheets = [
      { name: "Khách hàng", rows: [{ _line: 2, customer: "Khách thử" }] },
      { name: "Hóa đơn", rows: [{ _line: 2, code: "LEGACY-2", date: "2026-10-01",
        customer: "Khách thử", total: 100 }] },
    ];
    const result = imports.preview(sheets, store);
    assert.equal(result.issues.filter(x => x.severity === "warning").length, 2);
    assert.equal(result.issues.filter(x => x.severity === "error").length, 0);
    await imports.commit(store, { name: "warnings.xlsx", sheets });
    assert.equal(invoices.list(store)[0].total, 100);
    assert.equal(invoices.list(store)[0].due_date, "2026-10-01");
  } finally {
    store.close();
    if (!path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep))
      throw Error("Unsafe test path");
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("import rolls back customers, invoices and numbering when a receipt exceeds debt", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hoadon-import-rollback-"));
  const store = new Store(dir);
  try {
    const sheets = [
      { name: "Khách hàng", rows: [{ _line: 2, customer: "Khách rollback", phone: "0900000000" }] },
      { name: "Hóa đơn", rows: [{ _line: 2, code: "OLD-ROLLBACK", date: "2026-10-01",
        due: "2026-10-30", customer: "Khách rollback", total: 100 }] },
      { name: "Thu tiền", rows: [{ _line: 2, invoice: "OLD-ROLLBACK", date: "2026-10-02", amount: 200 }] },
    ];
    assert.deepEqual(imports.preview(sheets, store).issues, []);
    await assert.rejects(imports.commit(store, { name: "rollback.xlsx", sheets }), /vượt dư nợ/);
    assert.equal(customers.list(store).length, 0);
    assert.equal(invoices.list(store).length, 0);
    assert.equal(payments.list(store).length, 0);
    assert.equal(store.get("SELECT value FROM sequences WHERE kind='invoice'"), undefined);
    assert.equal(imports.history(store).length, 0);
  } finally {
    store.close();
    if (!path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep))
      throw Error("Unsafe test path");
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("import keeps total with tax when detail rows are absent", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hoadon-tax-import-"));
  const store = new Store(dir);
  try {
    const row = { _line: 2, code: "LEGACY-1", date: "2026-10-01", due: "2026-10-30",
      customer: "Khách cũ", total: 105, taxRate: 10, discount: 5 };
    const sheets = [{ name: "Hóa đơn", rows: [row] }];
    assert.deepEqual(imports.preview(sheets, store).issues, []);
    await imports.commit(store, { name: "tax.xlsx", sheets });
    const saved = invoices.list(store)[0];
    assert.equal(saved.subtotal, 100);
    assert.equal(saved.tax_rate, 10);
    assert.equal(saved.discount, 5);
    assert.equal(saved.total, 105);
    row.due = "2026-02-31";
    assert.match(imports.preview(sheets, store).issues[0].message, /Hạn thanh toán/);
    row.due = "2026-10-30";
    row.taxRate = 100; row.discount = 0; row.total = 3;
    assert.match(imports.preview(sheets, store).issues[0].message, /thiếu dòng chi tiết/);
  } finally {
    store.close();
    if (!path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep))
      throw Error("Unsafe test path");
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("new duplicate strategy links invoice to the newly created customer", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hoadon-duplicate-"));
  const store = new Store(dir);
  try {
    const old = customers.create(store, {
      name: "Khách trùng",
      phone: "0901111111",
    });
    const sheets = [
      {
        name: "Khách hàng",
        rows: [
          {
            _line: 2,
            customer: "Khách trùng",
            customerCode: "KH-OLD",
            phone: "0901111111",
          },
        ],
      },
      {
        name: "Hóa đơn",
        rows: [
          {
            _line: 2,
            code: "OLD-1",
            customer: "Khách trùng",
            customerCode: "KH-OLD",
            date: "2026-10-01",
            due: "2026-10-20",
            total: 100000,
          },
        ],
      },
    ];
    assert.deepEqual(imports.preview(sheets, store).issues, []);
    await imports.commit(store, { name: "duplicate.xlsx", sheets }, "new");
    const list = customers.list(store);
    assert.equal(list.length, 2);
    assert.notEqual(invoices.list(store)[0].customer_id, old.id);
    imports.undo(store);
    assert.deepEqual(
      customers.list(store).map((x) => x.id),
      [old.id],
    );
  } finally {
    store.close();
    if (!path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep))
      throw Error("Unsafe test path");
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
