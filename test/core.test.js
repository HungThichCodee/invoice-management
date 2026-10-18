"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Store } = require("../src/main/db");
const customers = require("../src/main/services/customers");
const invoices = require("../src/main/services/invoices");
const payments = require("../src/main/services/payments");
const settings = require("../src/main/services/settings");
const reports = require("../src/main/services/reports");

function fixture(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hoadon-test-"));
  const store = new Store(dir);
  try {
    return fn(store);
  } finally {
    store.close();
    if (!path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep))
      throw Error("Unsafe test path");
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
const invoiceInput = (customerId) => ({
  customerId,
  date: "2026-10-01",
  due: "2026-10-30",
  items: [{ name: "Thuê xe", qty: 2, price: 1000000, capacity: 3000 }],
});

test("creates customer, invoice and partial payment with correct balance", () =>
  fixture((store) => {
    const c = customers.create(store, { name: "Khách A", phone: "0901234567" });
    const i = invoices.create(store, invoiceInput(c.id));
    assert.equal(i.total, 2000000);
    assert.equal(i.items[0].capacity_kg, 3000);
    payments.create(store, {
      invoiceId: i.id,
      date: "2026-10-05",
      amount: 500000,
      method: "cash",
    });
    assert.equal(payments.list(store, { search: "0901234567" }).length, 1);
    assert.equal(invoices.get(store, i.id).balance, 1500000);
    assert.equal(customers.list(store)[0].balance, 1500000);
    const dashboard = reports.dashboard(store, "2026-10-17");
    assert.equal(dashboard.openCount, 1);
    assert.equal(dashboard.allCollectionRate, 25);
    assert.equal(dashboard.chart.at(-2).revenue, 0);
    assert.equal(dashboard.chart.at(-1).revenue, 2000000);
  }));

test("rejects negative input and overpayment at backend boundary", () =>
  fixture((store) => {
    const c = customers.create(store, { name: "Khách A" });
    assert.throws(
      () =>
        invoices.create(store, {
          ...invoiceInput(c.id),
          items: [{ name: "Xe", qty: -1, price: 100 }],
        }),
      /Số lượng/,
    );
    assert.throws(
      () =>
        invoices.create(store, {
          ...invoiceInput(c.id),
          items: [{ name: "Xe", qty: 1, price: -100 }],
        }),
      /Đơn giá/,
    );
    assert.throws(
      () =>
        invoices.create(store, {
          ...invoiceInput(c.id),
          items: [{ name: "Xe", qty: 1, price: 100, capacity: -3 }],
        }),
      /Trọng tải/,
    );
    const i = invoices.create(store, invoiceInput(c.id));
    assert.throws(
      () =>
        payments.create(store, {
          invoiceId: i.id,
          date: "2026-10-05",
          amount: -1,
        }),
      /Số tiền/,
    );
    assert.throws(
      () =>
        payments.create(store, {
          invoiceId: i.id,
          date: "2026-10-05",
          amount: 2000001,
        }),
      /vượt dư nợ/,
    );
    assert.equal(payments.list(store).length, 0);
  }));

test("rolls back invoice edit when item write fails after header update", () =>
  fixture((store) => {
    const c = customers.create(store, { name: "Khách A" });
    const i = invoices.create(store, invoiceInput(c.id));
    store.write(() =>
      store.db.exec(
        "CREATE TRIGGER reject_item BEFORE INSERT ON invoice_items WHEN NEW.name='Lỗi' BEGIN SELECT RAISE(ABORT,'injected failure'); END",
      ),
    );
    assert.throws(
      () =>
        invoices.update(store, {
          ...invoiceInput(c.id),
          id: i.id,
          note: "new note",
          items: [{ name: "Lỗi", qty: 1, price: 1 }],
        }),
      /injected failure/,
    );
    const after = invoices.get(store, i.id);
    assert.equal(after.note, "");
    assert.equal(after.revision, 1);
    assert.equal(after.items.length, 1);
    assert.equal(after.items[0].name, "Thuê xe");
  }));

test("bulk payment allocates oldest invoice first in one transaction", () =>
  fixture((store) => {
    const c = customers.create(store, { name: "Khách A" });
    const first = invoices.create(store, invoiceInput(c.id));
    const second = invoices.create(store, {
      ...invoiceInput(c.id),
      date: "2026-10-02",
    });
    const allocations = payments.allocate(store, {
      customerId: c.id,
      amount: 2500000,
    });
    assert.deepEqual(allocations, [
      { invoiceId: first.id, amount: 2000000 },
      { invoiceId: second.id, amount: 500000 },
    ]);
    payments.bulk(store, {
      customerId: c.id,
      amount: 2500000,
      allocations,
      date: "2026-10-10",
      method: "bank",
    });
    assert.equal(invoices.get(store, first.id).balance, 0);
    assert.equal(invoices.get(store, second.id).balance, 1500000);
  }));

test("manual bulk allocation honors chosen invoices and rolls back invalid input", () =>
  fixture((store) => {
    const c = customers.create(store, { name: "Khách phân bổ" });
    const first = invoices.create(store, invoiceInput(c.id));
    const second = invoices.create(store, invoiceInput(c.id));
    const base = { customerId: c.id, amount: 500000, date: "2026-10-10", method: "bank", strategy: "manual" };
    const chosen = [{ invoiceId: second.id, balance: 2000000, amount: 500000 }];
    assert.throws(() => payments.bulk(store, { ...base, allocations: [{ ...chosen[0], amount: -1 }] }), /Số tiền phân bổ/);
    assert.throws(() => payments.bulk(store, { ...base, allocations: [{ ...chosen[0], amount: 2000001 }] }), /vượt dư nợ/);
    assert.throws(() => payments.bulk(store, { ...base, allocations: [{ ...chosen[0], balance: 1 }] }), /đã thay đổi/);
    assert.equal(payments.list(store).length, 0);
    const result = payments.bulk(store, { ...base, allocations: chosen });
    assert.equal(result.ids.length, 1);
    assert.equal(invoices.get(store, first.id).balance, 2000000);
    assert.equal(invoices.get(store, second.id).balance, 1500000);
  }));

test("document numbering settings apply atomically and never lower counters", () =>
  fixture((store) => {
    const customer = customers.create(store, { name: "Khách đánh số" });
    settings.update(store, { invoicePrefix: "XN-", invoiceNumberLength: 4, invoiceCounter: 17,
      paymentPrefix: "TH-", paymentNumberLength: 5, paymentCounter: 8 });
    const invoice = invoices.create(store, invoiceInput(customer.id));
    assert.equal(invoice.id, "XN-0018");
    const receipt = payments.create(store, { invoiceId: invoice.id, date: "2026-10-05", amount: 1000 });
    assert.equal(receipt, "TH-00009");
    assert.throws(() => settings.update(store, { sellerName: "Sai", invoiceCounter: 1 }), /Không thể hạ bộ đếm/);
    assert.equal(settings.get(store).sellerName, undefined);
    assert.throws(() => settings.update(store, { invoicePrefix: "INVALID-PREFIX" }), /Tiền tố chứng từ/);
    settings.update(store, { fontSize: 15 });
    assert.equal(settings.get(store).fontSize, "15");
    assert.throws(() => settings.update(store, { sellerName: "Sai", fontSize: 12 }), /Cỡ chữ/);
    assert.equal(settings.get(store).sellerName, undefined);
  }));
