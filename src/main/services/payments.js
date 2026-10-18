"use strict";
const { clean, fail, integer, isoDate } = require("./validate");
const invoices = require("./invoices");
const now = () => new Date().toISOString();
function list(store, filter = {}) {
  let rows =
    store.all(`SELECT p.*,i.customer_id,c.name customer_name,c.phone customer_phone FROM payments p
    JOIN invoices i ON i.id=p.invoice_id JOIN customers c ON c.id=i.customer_id
    ORDER BY p.pay_date DESC,p.created_at DESC`);
  if (filter.customerId)
    rows = rows.filter((r) => r.customer_id === Number(filter.customerId));
  if (filter.invoiceId)
    rows = rows.filter((r) => r.invoice_id === filter.invoiceId);
  if (filter.from) rows = rows.filter((r) => r.pay_date >= filter.from);
  if (filter.to) rows = rows.filter((r) => r.pay_date <= filter.to);
  if (filter.method) rows = rows.filter((r) => r.method === filter.method);
  if (filter.search) {
    const q = clean(filter.search, 100).toLowerCase();
    rows = rows.filter((r) =>
      `${r.id} ${r.invoice_id} ${r.customer_name} ${r.customer_phone || ""}`
        .toLowerCase()
        .includes(q),
    );
  }
  return rows;
}
function normalize(input) {
  const amount = integer(input.amount, "Số tiền thu", 1000000000000);
  if (!amount) fail("Số tiền thu phải lớn hơn 0.");
  return {
    invoiceId: clean(input.invoiceId, 50),
    date: isoDate(input.date, "Ngày thu"),
    amount,
    method: ["cash", "bank", "other"].includes(input.method)
      ? input.method
      : "cash",
    note: clean(input.note, 1000),
  };
}
function insert(store, v) {
  const row = invoices.get(store, v.invoiceId);
  if (v.amount > row.balance) fail(`Số tiền thu vượt dư nợ của ${row.id}.`);
  const prefix =
    store.get("SELECT value FROM settings WHERE key='paymentPrefix'")?.value ||
    "PT";
  const width = Number(
    store.get("SELECT value FROM settings WHERE key='paymentNumberLength'")
      ?.value || 6,
  );
  const id = store.next("payment", prefix, width);
  store.run(
    "INSERT INTO payments(id,invoice_id,pay_date,amount,method,note,created_at) VALUES (?,?,?,?,?,?,?)",
    id,
    v.invoiceId,
    v.date,
    v.amount,
    v.method,
    v.note,
    now(),
  );
  store.audit("create", "payment", id);
  return id;
}
function create(store, input) {
  const v = normalize(input);
  return store.write(() => insert(store, v));
}
function update(store, input) {
  const id = clean(input.id, 50);
  return store.write(() => {
    const old = store.get("SELECT * FROM payments WHERE id=?", id);
    if (!old) fail("Không tìm thấy phiếu thu.");
    const v = normalize({ ...input, invoiceId: old.invoice_id });
    const bill = invoices.get(store, old.invoice_id);
    if (v.amount > bill.balance + old.amount) fail("Số tiền thu vượt dư nợ.");
    store.run(
      "UPDATE payments SET pay_date=?,amount=?,method=?,note=? WHERE id=?",
      v.date,
      v.amount,
      v.method,
      v.note,
      id,
    );
    store.audit("update", "payment", id);
    return id;
  });
}
function remove(store, id) {
  const key = clean(id, 50);
  return store.write(() => {
    if (!store.run("DELETE FROM payments WHERE id=?", key).changes)
      fail("Không tìm thấy phiếu thu.");
    store.audit("delete", "payment", key);
    return true;
  });
}
function allocate(store, input) {
  const customerId = integer(input.customerId, "Mã khách hàng");
  const amount = integer(input.amount, "Số tiền thu", 1000000000000);
  if (!amount) fail("Số tiền thu phải lớn hơn 0.");
  const open = invoices
    .list(store, { customerId })
    .filter((r) => r.balance > 0)
    .sort(
      (a, b) =>
        a.invoice_date.localeCompare(b.invoice_date) ||
        a.id.localeCompare(b.id),
    );
  if (input.strategy === "manual") {
    if (!Array.isArray(input.allocations)) fail("Thiếu bảng phân bổ thủ công.");
    const lookup = new Map(open.map((row) => [row.id, row]));
    const seen = new Set(),
      selected = [];
    let sum = 0;
    for (const entry of input.allocations) {
      const id = clean(entry.invoiceId, 50);
      if (seen.has(id)) fail("Hóa đơn bị lặp trong bảng phân bổ.");
      seen.add(id);
      const invoice = lookup.get(id);
      if (!invoice) fail("Hóa đơn không thuộc công nợ của khách này.");
      if (
        entry.balance !== undefined &&
        integer(entry.balance, "Dư nợ trước thu") !== invoice.balance
      )
        fail("Công nợ đã thay đổi. Vui lòng xem lại phân bổ.");
      const paid = integer(entry.amount, "Số tiền phân bổ", 1000000000000);
      if (paid > invoice.balance) fail(`Số tiền phân bổ vượt dư nợ của ${id}.`);
      if (paid) {
        sum += paid;
        if (sum > amount) fail("Tổng phân bổ vượt số tiền thu.");
        selected.push({ invoiceId: id, amount: paid });
      }
    }
    if (sum !== amount) fail("Tổng phân bổ phải bằng số tiền thu.");
    return selected;
  }
  if (input.strategy && input.strategy !== "auto")
    fail("Cách phân bổ không hợp lệ.");
  let remaining = amount;
  const allocations = open
    .map((r) => {
      const applied = Math.min(r.balance, remaining);
      remaining -= applied;
      return { invoiceId: r.id, amount: applied };
    })
    .filter((r) => r.amount > 0);
  if (remaining) fail("Số tiền thu vượt tổng công nợ.");
  return allocations;
}
function bulk(store, input) {
  const date = isoDate(input.date, "Ngày thu");
  return store.write(() => {
    const allocations = allocate(store, input);
    if (
      input.strategy !== "manual" &&
      input.allocations &&
      JSON.stringify(input.allocations) !== JSON.stringify(allocations)
    )
      fail("Công nợ đã thay đổi. Vui lòng xem lại phân bổ.");
    const ids = allocations.map((a) =>
      insert(store, normalize({ ...input, ...a, date })),
    );
    store.audit("bulk", "payment", ids.join(","));
    return { ids, allocations };
  });
}
module.exports = { list, normalize, create, update, remove, allocate, bulk };
