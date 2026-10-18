"use strict";

module.exports = `
CREATE TABLE IF NOT EXISTS sequences(kind TEXT PRIMARY KEY, value INTEGER NOT NULL CHECK(value >= 0));
CREATE TABLE IF NOT EXISTS customers(
  id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS invoices(
  id TEXT PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id),
  invoice_date TEXT NOT NULL, due_date TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
  tax_rate INTEGER NOT NULL DEFAULT 0 CHECK(tax_rate BETWEEN 0 AND 100),
  discount INTEGER NOT NULL DEFAULT 0 CHECK(discount >= 0),
  subtotal INTEGER NOT NULL CHECK(subtotal >= 0),
  total INTEGER NOT NULL CHECK(total >= 0),
  revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS invoice_items(
  id INTEGER PRIMARY KEY, invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'service', name TEXT NOT NULL, unit TEXT NOT NULL DEFAULT '',
  qty_milli INTEGER NOT NULL CHECK(qty_milli > 0),
  price INTEGER NOT NULL CHECK(price >= 0), amount INTEGER NOT NULL CHECK(amount >= 0),
  model TEXT NOT NULL DEFAULT '', serial TEXT NOT NULL DEFAULT '',
  capacity_kg INTEGER NOT NULL DEFAULT 0 CHECK(capacity_kg >= 0),
  hours_milli INTEGER NOT NULL DEFAULT 0 CHECK(hours_milli >= 0), sort_order INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS payments(
  id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL REFERENCES invoices(id),
  pay_date TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount > 0),
  method TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS catalog_items(
  id INTEGER PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('vehicle','part')),
  name TEXT NOT NULL, model TEXT NOT NULL DEFAULT '', serial TEXT NOT NULL DEFAULT '',
  capacity_kg INTEGER NOT NULL DEFAULT 0 CHECK(capacity_kg >= 0),
  hours_milli INTEGER NOT NULL DEFAULT 0 CHECK(hours_milli >= 0),
  price INTEGER NOT NULL DEFAULT 0 CHECK(price >= 0)
);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS import_batches(
  id INTEGER PRIMARY KEY, source_name TEXT NOT NULL, counts_json TEXT NOT NULL,
  undo_json TEXT NOT NULL, created_at TEXT NOT NULL, undone_at TEXT
);
CREATE TABLE IF NOT EXISTS audit_logs(
  id INTEGER PRIMARY KEY, action TEXT NOT NULL, entity TEXT NOT NULL,
  entity_id TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_invoice_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoice_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_payment_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_date ON payments(pay_date);
`;
