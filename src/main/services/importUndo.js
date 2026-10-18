"use strict";
const { fail } = require("./validate");
const stamp = () => new Date().toISOString();
function history(store) {
  return store.all(
    "SELECT id,source_name,counts_json,created_at,undone_at FROM import_batches ORDER BY id DESC",
  );
}
function undo(store) {
  return store.write(() => {
    const batch = store.get(
      "SELECT * FROM import_batches WHERE undone_at IS NULL ORDER BY id DESC LIMIT 1",
    );
    if (!batch) fail("Không có lần nhập để hoàn tác.");
    const plan = JSON.parse(batch.undo_json);
    for (const id of plan.payments)
      store.run("DELETE FROM payments WHERE id=?", id);
    for (const id of plan.invoices) {
      if (store.get("SELECT 1 FROM payments WHERE invoice_id=?", id))
        fail("Hóa đơn nhập đã có phiếu thu mới.");
      store.run("DELETE FROM invoices WHERE id=?", id);
    }
    for (const old of plan.oldInvoices) {
      const r = old.row;
      const newer = store
        .all("SELECT id,created_at FROM payments WHERE invoice_id=?", r.id)
        .some(
          (p) =>
            p.created_at > batch.created_at && !plan.payments.includes(p.id),
        );
      if (newer) fail(`Hóa đơn ${r.id} có phiếu thu mới, không thể hoàn tác.`);
      store.run(
        "UPDATE invoices SET customer_id=?,invoice_date=?,due_date=?,note=?,tax_rate=?,discount=?,subtotal=?,total=?,revision=?,updated_at=? WHERE id=?",
        r.customer_id,
        r.invoice_date,
        r.due_date,
        r.note,
        r.tax_rate,
        r.discount,
        r.subtotal,
        r.total,
        r.revision,
        r.updated_at,
        r.id,
      );
      store.run("DELETE FROM invoice_items WHERE invoice_id=?", r.id);
      for (const i of old.items)
        store.run(
          "INSERT INTO invoice_items(id,invoice_id,kind,name,unit,qty_milli,price,amount,model,serial,capacity_kg,hours_milli,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
          i.id,
          i.invoice_id,
          i.kind,
          i.name,
          i.unit,
          i.qty_milli,
          i.price,
          i.amount,
          i.model,
          i.serial,
          i.capacity_kg,
          i.hours_milli,
          i.sort_order,
        );
    }
    for (const id of plan.customers) {
      if (!store.get("SELECT 1 FROM invoices WHERE customer_id=?", id))
        store.run("DELETE FROM customers WHERE id=?", id);
    }
    for (const c of plan.oldCustomers || [])
      store.run(
        "UPDATE customers SET name=?,phone=?,address=?,contact=?,note=?,updated_at=? WHERE id=?",
        c.name,
        c.phone,
        c.address,
        c.contact,
        c.note,
        c.updated_at,
        c.id,
      );
    for (const id of plan.catalog)
      store.run("DELETE FROM catalog_items WHERE id=?", id);
    store.run(
      "UPDATE import_batches SET undone_at=? WHERE id=?",
      stamp(),
      batch.id,
    );
    store.audit("undo", "batch", batch.id);
    return batch.id;
  });
}
module.exports = { history, undo };
