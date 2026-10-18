"use strict";
const fs = require("node:fs");
const path = require("node:path");
const invoices = require("./invoices");
const payments = require("./payments");
const customers = require("./customers");
const settings = require("./settings");
const safe = (value) => String(value ?? "").replace(/^[=+@\-]/, "'$&");
const shortDate = (value) =>
  value ? String(value).slice(2, 10).split("-").reverse().join("/") : "";
const reportMonth = (value) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(value)))
    throw Error("Tháng báo cáo không hợp lệ.");
  return String(value);
};
function folder(store) {
  const dir =
    settings.get(store).exportFolder || path.join(store.folder, "exports");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function file(store, prefix, ext) {
  return path.join(
    folder(store),
    `${prefix}_${new Date().toISOString().replace(/[:.]/g, "-")}.${ext}`,
  );
}
function rows(store, filter = {}) {
  const bills = invoices.list(store, filter),
    ids = new Set(bills.map((x) => x.id));
  const details = bills.flatMap((i) =>
    invoices
      .get(store, i.id)
      .items.map((r) => [
        i.id,
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
      ]),
  );
  const receipts = payments.list(store).filter((p) => ids.has(p.invoice_id));
  return { bills, details, receipts, clients: customers.list(store) };
}
module.exports = { safe, shortDate, reportMonth, folder, file, rows };
