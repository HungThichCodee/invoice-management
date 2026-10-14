'use strict';
const { normalizeName, normalizePhone, matchKey } = require('../shared/core');
function migrateV1toV2(db) {
  db.exec(`
    ALTER TABLE customers ADD COLUMN customer_code TEXT;
    ALTER TABLE customers ADD COLUMN note TEXT NOT NULL DEFAULT '';
    ALTER TABLE customers ADD COLUMN normalized_phone TEXT NOT NULL DEFAULT '';
    ALTER TABLE customers ADD COLUMN normalized_name TEXT NOT NULL DEFAULT '';
    ALTER TABLE customers ADD COLUMN import_batch_id TEXT;
    ALTER TABLE invoices ADD COLUMN customer_name TEXT;
    ALTER TABLE invoices ADD COLUMN customer_phone TEXT;
    ALTER TABLE invoices ADD COLUMN customer_address TEXT;
    ALTER TABLE invoices ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
    ALTER TABLE invoices ADD COLUMN import_batch_id TEXT;
    ALTER TABLE payments ADD COLUMN import_batch_id TEXT;
    CREATE TABLE import_batches(id TEXT PRIMARY KEY,source_name TEXT NOT NULL,kind TEXT NOT NULL,strategy TEXT NOT NULL,counts_json TEXT NOT NULL,undo_json TEXT NOT NULL,created_at TEXT NOT NULL,undone_at TEXT);
  `);
  db.exec(`UPDATE invoices SET customer_name=(SELECT name FROM customers WHERE id=customer_id),customer_phone=(SELECT phone FROM customers WHERE id=customer_id),customer_address=(SELECT address FROM customers WHERE id=customer_id)`);
  const customers=db.prepare('SELECT * FROM customers ORDER BY id').all(),groups=new Map();
  for(const c of customers){const k=matchKey(c.name,c.phone);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(c);}
  const updateInvoice=db.prepare('UPDATE invoices SET customer_id=? WHERE customer_id=?');
  const removeCustomer=db.prepare('DELETE FROM customers WHERE id=?');
  const updateCustomer=db.prepare('UPDATE customers SET customer_code=?,normalized_phone=?,normalized_name=?,normalized_key=? WHERE id=?');
  for(const [key,group] of groups){const canonical=group[0];for(const duplicate of group.slice(1)){updateInvoice.run(canonical.id,duplicate.id);removeCustomer.run(duplicate.id);}updateCustomer.run(`KH-${String(canonical.id).padStart(6,'0')}`,normalizePhone(canonical.phone),normalizeName(canonical.name),key,canonical.id);}
  db.exec('CREATE UNIQUE INDEX idx_customers_code ON customers(customer_code); CREATE INDEX idx_customers_phone ON customers(normalized_phone); CREATE INDEX idx_customers_name ON customers(normalized_name); CREATE INDEX idx_invoices_import_batch ON invoices(import_batch_id); CREATE INDEX idx_payments_import_batch ON payments(import_batch_id);');
  let max=0;for(const x of db.prepare('SELECT id FROM invoices').all()){const m=/(?:^|[-_])(\d{1,9})$/.exec(x.id);if(m)max=Math.max(max,Number(m[1]));}
  db.prepare("INSERT INTO settings(key,value) VALUES ('invoiceCounter',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(max));
  db.pragma('user_version = 2');
}
module.exports={migrateV1toV2};
