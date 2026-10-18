"use strict";
const { clean, fail, integer, milli, isoDate } = require("./validate");
const customers = require("./customers");
const now = () => new Date().toISOString();
const today = () => new Date().toLocaleDateString("en-CA");
function normalize(input) {
  const customerId = integer(input.customerId, "Khách hàng");
  const date = isoDate(input.date, "Ngày hóa đơn"),
    due = isoDate(input.due, "Hạn thanh toán");
  if (due < date) fail("Hạn thanh toán phải sau ngày hóa đơn.");
  const rows = Array.isArray(input.items) ? input.items : [];
  if (!rows.length) fail("Hóa đơn cần ít nhất một mặt hàng.");
  const items = rows.map((r, i) => {
    const name = clean(r.name, 300),
      qty = milli(r.qty, "Số lượng"),
      price = integer(r.price, "Đơn giá", 1000000000000);
    if (!name || qty <= 0) fail(`Dòng ${i + 1} thiếu tên hoặc số lượng.`);
    const amount = Math.round((qty * price) / 1000);
    if (!Number.isSafeInteger(amount)) fail("Thành tiền vượt giới hạn.");
    return {
      kind: ["service", "vehicle", "part"].includes(r.kind)
        ? r.kind
        : "service",
      name,
      unit: clean(r.unit, 30),
      qty,
      price,
      amount,
      model: clean(r.model, 100),
      serial: clean(r.serial, 100),
      capacity: integer(r.capacity || 0, "Trọng tải"),
      hours: milli(r.hours || 0, "Số giờ"),
      order: i,
    };
  });
  const subtotal = items.reduce((n, r) => n + r.amount, 0);
  const taxRate = integer(input.taxRate || 0, "Thuế", 100),
    discount = integer(input.discount || 0, "Giảm giá", 1000000000000);
  const tax = Math.round((subtotal * taxRate) / 100),
    total = subtotal + tax - discount;
  if (!Number.isSafeInteger(total) || total < 0)
    fail("Tổng tiền không hợp lệ.");
  return {
    customerId,
    date,
    due,
    note: clean(input.note, 2000),
    taxRate,
    discount,
    subtotal,
    total,
    items,
  };
}
function writeItems(store, id, rows) {
  for (const r of rows)
    store.run(
      `INSERT INTO invoice_items
    (invoice_id,kind,name,unit,qty_milli,price,amount,model,serial,capacity_kg,hours_milli,sort_order)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      id,
      r.kind,
      r.name,
      r.unit,
      r.qty,
      r.price,
      r.amount,
      r.model,
      r.serial,
      r.capacity,
      r.hours,
      r.order,
    );
}
function status(row, date = today()) {
  if (row.balance <= 0) return "paid";
  if (row.due_date < date) return "overdue";
  return row.paid > 0 ? "partial" : "unpaid";
}
function list(store, filter = {}) {
  const search = `%${clean(filter.search, 100)}%`;
  let rows = store
    .all(
      `SELECT i.*,c.code customer_code,c.name customer_name,c.phone customer_phone,
    COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id=i.id),0) paid
    FROM invoices i JOIN customers c ON c.id=i.customer_id
    WHERE i.id LIKE ? OR c.name LIKE ? OR c.phone LIKE ? ORDER BY i.invoice_date DESC,i.id DESC`,
      search,
      search,
      search,
    )
    .map((r) => ({
      ...r,
      balance: r.total - r.paid,
      status: status({ ...r, balance: r.total - r.paid }),
    }));
  if (filter.customerId)
    rows = rows.filter((r) => r.customer_id === Number(filter.customerId));
  if (filter.status === "open") rows = rows.filter((r) => r.balance > 0);
  else if (filter.status && filter.status !== "all")
    rows = rows.filter((r) => r.status === filter.status);
  if (filter.from) rows = rows.filter((r) => r.invoice_date >= filter.from);
  if (filter.to) rows = rows.filter((r) => r.invoice_date <= filter.to);
  if (filter.ids !== undefined) {
    if (!Array.isArray(filter.ids) || filter.ids.length > 10000)
      fail("Danh sách hóa đơn không hợp lệ.");
    const ids = new Set(filter.ids.map((id) => clean(id, 50)));
    rows = rows.filter((r) => ids.has(r.id));
  }
  return rows;
}
function get(store, id) {
  const row = list(store).find((r) => r.id === clean(id, 50));
  if (!row) fail("Không tìm thấy hóa đơn.");
  row.items = store
    .all(
      "SELECT * FROM invoice_items WHERE invoice_id=? ORDER BY sort_order",
      row.id,
    )
    .map((r) => ({
      ...r,
      qty: r.qty_milli / 1000,
      hours: r.hours_milli / 1000,
      capacity: r.capacity_kg,
    }));
  return row;
}
function create(store, input) {
  const v = normalize(input);
  return store.write(() => {
    customers.get(store, v.customerId);
    const prefix =
      store.get("SELECT value FROM settings WHERE key='invoicePrefix'")
        ?.value || "HD";
    const width = Number(
      store.get("SELECT value FROM settings WHERE key='invoiceNumberLength'")
        ?.value || 6,
    );
    const id = store.next("invoice", prefix, width),
      t = now();
    store.run(
      `INSERT INTO invoices(id,customer_id,invoice_date,due_date,note,tax_rate,discount,subtotal,total,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      id,
      v.customerId,
      v.date,
      v.due,
      v.note,
      v.taxRate,
      v.discount,
      v.subtotal,
      v.total,
      t,
      t,
    );
    writeItems(store, id, v.items);
    store.audit("create", "invoice", id);
    return get(store, id);
  });
}
function update(store, input) {
  const id = clean(input.id, 50),
    v = normalize(input);
  return store.write(() => {
    const old = get(store, id);
    customers.get(store, v.customerId);
    if (old.paid > v.total) fail("Tổng mới nhỏ hơn tiền đã thu.");
    store.run(
      `UPDATE invoices SET customer_id=?,invoice_date=?,due_date=?,note=?,tax_rate=?,discount=?,subtotal=?,total=?,revision=revision+1,updated_at=? WHERE id=?`,
      v.customerId,
      v.date,
      v.due,
      v.note,
      v.taxRate,
      v.discount,
      v.subtotal,
      v.total,
      now(),
      id,
    );
    store.run("DELETE FROM invoice_items WHERE invoice_id=?", id);
    writeItems(store, id, v.items);
    store.audit("update", "invoice", id);
    return get(store, id);
  });
}
function remove(store, id) {
  const key = clean(id, 50);
  return store.write(() => {
    const old = get(store, key);
    if (old.paid > 0) fail("Không thể xóa hóa đơn đã có phiếu thu.");
    store.run("DELETE FROM invoices WHERE id=?", key);
    store.audit("delete", "invoice", key);
    return true;
  });
}
module.exports = { list, get, create, update, remove, normalize, writeItems };
