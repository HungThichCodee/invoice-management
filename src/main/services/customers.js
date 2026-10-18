"use strict";
const { clean, fail, integer } = require("./validate");
const now = () => new Date().toISOString();
function normalize(input) {
  const v = {
    name: clean(input.name, 200),
    phone: clean(input.phone, 40),
    address: clean(input.address, 500),
    contact: clean(input.contact, 150),
    note: clean(input.note, 1000),
  };
  if (!v.name) fail("Nhập tên khách hàng.");
  return v;
}
function list(store, query = "") {
  const q = `%${clean(query, 100)}%`;
  return store
    .all(
      `SELECT c.*,COALESCE(SUM(i.total),0) total,
    COALESCE((SELECT SUM(p.amount) FROM payments p JOIN invoices pi ON pi.id=p.invoice_id WHERE pi.customer_id=c.id),0) paid
    FROM customers c LEFT JOIN invoices i ON i.customer_id=c.id
    WHERE c.name LIKE ? OR c.phone LIKE ? OR c.code LIKE ? GROUP BY c.id ORDER BY c.name`,
      q,
      q,
      q,
    )
    .map((c) => ({ ...c, balance: c.total - c.paid }));
}
function get(store, id) {
  const c = store.get(
    "SELECT * FROM customers WHERE id=?",
    integer(id, "Mã khách hàng"),
  );
  if (!c) fail("Không tìm thấy khách hàng.");
  return c;
}
function create(store, input) {
  const v = normalize(input);
  return store.write(() => {
    const code = store.next("customer", "KH");
    const t = now();
    const r = store.run(
      "INSERT INTO customers(code,name,phone,address,contact,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)",
      code,
      v.name,
      v.phone,
      v.address,
      v.contact,
      v.note,
      t,
      t,
    );
    store.audit("create", "customer", r.lastInsertRowid);
    return get(store, Number(r.lastInsertRowid));
  });
}
function update(store, input) {
  const id = integer(input.id, "Mã khách hàng"),
    v = normalize(input);
  return store.write(() => {
    get(store, id);
    store.run(
      "UPDATE customers SET name=?,phone=?,address=?,contact=?,note=?,updated_at=? WHERE id=?",
      v.name,
      v.phone,
      v.address,
      v.contact,
      v.note,
      now(),
      id,
    );
    store.audit("update", "customer", id);
    return get(store, id);
  });
}
function remove(store, id) {
  const key = integer(id, "Mã khách hàng");
  return store.write(() => {
    if (store.get("SELECT 1 FROM invoices WHERE customer_id=? LIMIT 1", key))
      fail("Khách hàng đã có hóa đơn.");
    const r = store.run("DELETE FROM customers WHERE id=?", key);
    if (!r.changes) fail("Không tìm thấy khách hàng.");
    store.audit("delete", "customer", key);
    return true;
  });
}
module.exports = { list, get, create, update, remove };
