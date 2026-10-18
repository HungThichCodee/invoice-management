"use strict";
const customers = require("./customers");
const invoices = require("./invoices");
const payments = require("./payments");
const { clean, fail, integer, milli } = require("./validate");
const backups = require("./backups");
const { subtotalForTotal, preview } = require("./importPreview");
const stamp = () => new Date().toISOString();
function invoiceInput(r, details, customerId) {
  const items = details.length
    ? details.map((d) => ({
        name: d.name,
        unit: d.unit,
        qty: d.qty,
        price: d.price,
        kind: d.kind,
        model: d.model,
        serial: d.serial,
        capacity: d.capacity,
        hours: d.hours,
      }))
    : [
        {
          name: "Giá trị hóa đơn nhập",
          unit: "lần",
          qty: 1,
          price: subtotalForTotal(r.total, r.taxRate, r.discount),
        },
      ];
  return {
    customerId,
    date: r.date,
    due: r.due || r.date,
    items,
    taxRate: r.taxRate || 0,
    discount: r.discount || 0,
    note: `Nhập từ file: ${r._sheet}`,
  };
}
async function commit(store, session, strategy = "skip") {
  if (!["skip", "update", "new"].includes(strategy))
    fail("Cách xử lý trùng không hợp lệ.");
  const p = preview(session.sheets, store);
  if (p.issues.some((x) => x.severity !== "warning"))
    fail("File còn lỗi. Hãy xử lý trước khi nhập.");
  await backups.create(store, "before_import");
  return store.write(() => {
    const undo = {
      customers: [],
      oldCustomers: [],
      invoices: [],
      payments: [],
      catalog: [],
      oldInvoices: [],
    };
    const mapping = new Map(),
      customerMap = new Map();
    const findCustomer = (name, phone = "") =>
      clean(phone)
        ? store.get(
            "SELECT * FROM customers WHERE lower(name)=lower(?) AND phone=? LIMIT 1",
            clean(name),
            clean(phone),
          )
        : store.get(
            "SELECT * FROM customers WHERE lower(name)=lower(?) LIMIT 1",
            clean(name),
          );
    for (const c of p.groups.customers) {
      const name = clean(c.customer || c.name),
        old = findCustomer(name, c.phone);
      if (old && strategy === "skip") {
        if (clean(c.customerCode))
          customerMap.set(clean(c.customerCode), old.id);
        customerMap.set(name.toLowerCase(), old.id);
        continue;
      }
      if (old && strategy === "update") {
        undo.oldCustomers.push(old);
        customers.update(store, {
          id: old.id,
          name,
          phone: c.phone,
          address: c.address,
          contact: old.contact,
          note: old.note,
        });
        if (clean(c.customerCode))
          customerMap.set(clean(c.customerCode), old.id);
        customerMap.set(name.toLowerCase(), old.id);
        continue;
      }
      const created = customers.create(store, {
        name,
        phone: c.phone,
        address: c.address,
      });
      undo.customers.push(created.id);
      if (clean(c.customerCode))
        customerMap.set(clean(c.customerCode), created.id);
      customerMap.set(name.toLowerCase(), created.id);
    }
    for (const r of p.groups.invoices) {
      let client = store.get(
        "SELECT * FROM customers WHERE id=?",
        customerMap.get(
          clean(r.customerCode) || clean(r.customer).toLowerCase(),
        ) || -1,
      );
      if (!client) client = findCustomer(r.customer, r.phone);
      if (!client) {
        client = customers.create(store, {
          name: r.customer,
          phone: r.phone,
          address: r.address,
        });
        undo.customers.push(client.id);
      }
      const oldId = clean(r.code),
        old = oldId && store.get("SELECT * FROM invoices WHERE id=?", oldId);
      if (old && strategy === "skip") {
        mapping.set(oldId, oldId);
        continue;
      }
      const details = p.groups.details.filter(
        (d) => clean(d.invoice) === oldId,
      );
      const input = invoiceInput(r, details, client.id);
      let created;
      if (old && strategy === "update") {
        undo.oldInvoices.push({
          row: old,
          items: store.all(
            "SELECT * FROM invoice_items WHERE invoice_id=?",
            oldId,
          ),
        });
        created = invoices.update(store, { ...input, id: oldId });
      } else {
        created = invoices.create(store, input);
        undo.invoices.push(created.id);
      }
      if (oldId) mapping.set(oldId, created.id);
    }
    for (const r of p.groups.payments) {
      const id = mapping.get(clean(r.invoice)) || clean(r.invoice);
      if (!store.get("SELECT 1 FROM invoices WHERE id=?", id))
        fail(`Không tìm thấy hóa đơn ${r.invoice}.`);
      undo.payments.push(
        payments.create(store, {
          invoiceId: id,
          date: r.date,
          amount: r.amount,
          method: /bank|chuyen/i.test(String(r.method)) ? "bank" : "cash",
        }),
      );
    }
    for (const [kind, records] of [
      ["vehicle", p.groups.vehicles],
      ["part", p.groups.parts],
    ]) {
      for (const r of records) {
        const result = store.run(
          "INSERT INTO catalog_items(kind,name,model,serial,capacity_kg,hours_milli,price) VALUES (?,?,?,?,?,?,?)",
          kind,
          clean(r.name),
          clean(r.model),
          clean(r.serial),
          integer(r.capacity || 0, "Trọng tải"),
          milli(r.hours || 0, "Số giờ"),
          integer(r.price || 0, "Đơn giá"),
        );
        undo.catalog.push(Number(result.lastInsertRowid));
      }
    }
    const result = store.run(
      "INSERT INTO import_batches(source_name,counts_json,undo_json,created_at) VALUES (?,?,?,?)",
      session.name,
      JSON.stringify(p.counts),
      JSON.stringify(undo),
      stamp(),
    );
    store.audit("import", "batch", result.lastInsertRowid);
    return { id: Number(result.lastInsertRowid), counts: p.counts };
  });
}
module.exports = { commit };
