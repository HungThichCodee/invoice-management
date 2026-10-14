'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Database = require('better-sqlite3');
const { clean, money, date, invoiceInput, status, report, periodReports, normalizeName, normalizePhone, matchKey } = require('../shared/core');
const { customerProfile, bulkPlan } = require('../shared/finance');
const { migrateV1toV2 } = require('./migrations');
const SCHEMA = `
CREATE TABLE IF NOT EXISTS customers(id INTEGER PRIMARY KEY, name TEXT NOT NULL, phone TEXT, address TEXT, normalized_key TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS invoices(id TEXT PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id), invoice_date TEXT NOT NULL, due_date TEXT, total INTEGER NOT NULL CHECK(total > 0), note TEXT, revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS invoice_items(id INTEGER PRIMARY KEY, invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE, name TEXT NOT NULL, unit TEXT, qty REAL NOT NULL CHECK(qty > 0), price INTEGER NOT NULL CHECK(price >= 0), amount INTEGER NOT NULL CHECK(amount >= 0), sort_order INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS payments(id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL REFERENCES invoices(id), pay_date TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount > 0), method TEXT, note TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS audit_logs(id INTEGER PRIMARY KEY, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, before_json TEXT, after_json TEXT, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(pay_date);
`;
const stamp = () => new Date().toISOString();
const uid = prefix => `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
class Store {
  constructor(folder) {
    fs.mkdirSync(folder, { recursive: true });
    this.folder = folder;
    this.file = path.join(folder, 'hoadon_xenang.db');
    this.db = new Database(this.file);
    this.db.pragma('foreign_keys = ON'); this.db.pragma('journal_mode = WAL');
    const version = this.db.pragma('user_version', { simple: true });
    if (version > 2) throw Error('Database được tạo bằng phiên bản ứng dụng mới hơn.');
    if (version < 1) {
      if (fs.existsSync(this.file) && fs.statSync(this.file).size > 0 && this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' LIMIT 1").get()) this.backup('pre-migration');
      this.db.transaction(() => { this.db.exec(SCHEMA); this.db.pragma('user_version = 1'); })();
    }
    if (this.db.pragma('user_version', { simple: true }) < 2) {
      if (version >= 1) this.backup('pre-migration');
      this.db.transaction(() => migrateV1toV2(this.db))();
    }
    this.dailyBackup();
  }
  close() { if (this.db.open) this.db.close(); }
  log(action, type, id, before, after) { this.db.prepare('INSERT INTO audit_logs(action,entity_type,entity_id,before_json,after_json,created_at) VALUES (?,?,?,?,?,?)').run(action, type, id, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null, stamp()); }
  backup(label = 'manual') {
    const dir = path.join(this.folder, 'backup'); fs.mkdirSync(dir, { recursive: true });
    const name = `hoadon_${label}_${new Date().toISOString().replace(/[:.]/g, '-')}_${crypto.randomBytes(2).toString('hex')}.db`;
    const dest = path.join(dir, name); this.db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
    const files = fs.readdirSync(dir).filter(x => x.endsWith('.db')).map(x=>({name:x,time:fs.statSync(path.join(dir,x)).mtimeMs})).sort((a,b)=>b.time-a.time);
    for (const old of files.slice(30)) fs.unlinkSync(path.join(dir, old.name));
    return dest;
  }
  dailyBackup() {
    const day = new Date().toISOString().slice(0, 10);
    const dir = path.join(this.folder, 'backup');
    if (!fs.existsSync(dir) || !fs.readdirSync(dir).some(x => x.startsWith(`hoadon_daily_${day}`))) return this.backup(`daily_${day}`);
    return null;
  }
  settings() { return Object.fromEntries(this.db.prepare('SELECT key,value FROM settings').all().map(x => [x.key, x.value])); }
  saveSettings(values) {
    const allowed = ['invoicePrefix','sellerName','sellerAddress','sellerPhone','sellerNote','sellerLogo','exportFolder','darkMode'];
    return this.db.transaction(() => { for (const k of allowed) if (Object.hasOwn(values, k)) { const v = clean(values[k], k === 'sellerNote' ? 1000 : 500); this.db.prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k, v); this.log('settings', 'setting', k, null, v); } return this.settings(); })();
  }
  insertCustomer(v, batchId = null) {
    const now=stamp(),phone=normalizePhone(v.phone),name=normalizeName(v.customer),match=matchKey(v.customer,v.phone);
    let uniqueKey=match;
    if(this.db.prepare('SELECT 1 FROM customers WHERE normalized_key=?').get(uniqueKey))uniqueKey=`${match}#${uid('KH')}`;
    const r=this.db.prepare('INSERT INTO customers(name,phone,address,note,normalized_key,normalized_phone,normalized_name,import_batch_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run(v.customer,v.phone,v.address,v.customerNote||'',uniqueKey,phone,name,batchId,now,now);
    const id=Number(r.lastInsertRowid),code=`KH-${String(id).padStart(6,'0')}`;
    this.db.prepare('UPDATE customers SET customer_code=? WHERE id=?').run(code,id);
    this.log('create','customer',String(id),null,{code,name:v.customer,phone:v.phone});return id;
  }
  customerFor(v, options = {}) {
    if(options.customerId){const c=this.db.prepare('SELECT * FROM customers WHERE id=?').get(Number(options.customerId));if(!c)throw Error('Khách hàng đã chọn không tồn tại.');return c.id;}
    const phone=normalizePhone(v.phone),name=normalizeName(v.customer);
    const matches=phone?this.db.prepare('SELECT * FROM customers WHERE normalized_phone=? ORDER BY id').all(phone):this.db.prepare('SELECT * FROM customers WHERE normalized_phone=? AND normalized_name=? ORDER BY id').all('',name);
    if(matches.length&&!options.forceNew){if(phone&&matches[0].normalized_name!==name&&!options.acceptExistingPhone)throw Error('Số điện thoại đã tồn tại. Chọn dùng khách cũ hoặc tạo mới.');return matches[0].id;}
    if(!options.forceNew&&!options.acceptSimilar&&this.db.prepare('SELECT 1 FROM customers WHERE normalized_name=? LIMIT 1').get(name))throw Error('Đã có khách cùng tên với số điện thoại khác. Xác nhận tạo khách mới.');
    return this.insertCustomer(v,options.batchId||null);
  }
  createCustomer(input){const v={customer:clean(input.name,200),phone:clean(input.phone,40),address:clean(input.address,500),customerNote:clean(input.note,1000)};if(!v.customer)throw Error('Nhập tên khách hàng.');return this.db.transaction(()=>this.customerFor(v,{forceNew:!!input.forceNew,acceptSimilar:!!input.acceptSimilar,acceptExistingPhone:!!input.acceptExistingPhone}))();}
  updateCustomer(input){return this.db.transaction(()=>{const id=Number(input.id),old=this.db.prepare('SELECT * FROM customers WHERE id=?').get(id);if(!old)throw Error('Không tìm thấy khách hàng.');const name=clean(input.name,200),phone=clean(input.phone,40),address=clean(input.address,500),note=clean(input.note,1000);if(!name)throw Error('Nhập tên khách hàng.');const match=matchKey(name,phone),clash=this.db.prepare('SELECT id FROM customers WHERE normalized_key=? AND id<>?').get(match,id),uniqueKey=clash?`${match}#${id}`:match;this.db.prepare('UPDATE customers SET name=?,phone=?,address=?,note=?,normalized_key=?,normalized_phone=?,normalized_name=?,updated_at=? WHERE id=?').run(name,phone,address,note,uniqueKey,normalizePhone(phone),normalizeName(name),stamp(),id);this.log('update','customer',String(id),old,{name,phone,address,note});return id;})();}
  nextInvoiceId(){const prefix=clean(this.settings().invoicePrefix||'HD',16).replace(/[^A-Za-z0-9_-]/g,'')||'HD';let n=Number(this.settings().invoiceCounter||0);let id;do{n++;id=`${prefix}-${String(n).padStart(6,'0')}`;}while(this.db.prepare('SELECT 1 FROM invoices WHERE id=?').get(id));this.db.prepare("INSERT INTO settings(key,value) VALUES ('invoiceCounter',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(n));return id;}
  observeInvoiceId(id){const m=/(?:^|[-_])(\d{1,9})$/.exec(id);if(!m)return;const n=Number(m[1]),old=Number(this.settings().invoiceCounter||0);if(n>old)this.db.prepare("INSERT INTO settings(key,value) VALUES ('invoiceCounter',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(n));}
  writeItems(id, items) { const add = this.db.prepare('INSERT INTO invoice_items(invoice_id,name,unit,qty,price,amount,sort_order) VALUES (?,?,?,?,?,?,?)'); items.forEach((x, n) => add.run(id, x.name, x.unit, x.qty, x.price, x.amount, n)); }
  createInvoice(input) {
    const v = invoiceInput(input);
    return this.db.transaction(() => {
      const customerId = this.customerFor(v, input);
      const id = this.nextInvoiceId(), now = stamp();
      this.db.prepare('INSERT INTO invoices(id,customer_id,invoice_date,due_date,total,note,customer_name,customer_phone,customer_address,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(id, customerId, v.date, v.due || null, v.total, v.note,v.customer,v.phone,v.address,now, now);
      this.writeItems(id, v.items); this.log('create', 'invoice', id, null, v);
      return id;
    })();
  }
  editable(id, revision) {
    const row = this.db.prepare('SELECT * FROM invoices WHERE id=?').get(clean(id, 100));
    if (!row) throw Error('Không tìm thấy hóa đơn.');
    if (this.db.prepare('SELECT 1 FROM payments WHERE invoice_id=? LIMIT 1').get(id)) throw Error('Hóa đơn đã có phiếu thu; không thể sửa hoặc xóa.');
    if (revision !== undefined && Number(revision) !== row.revision) throw Error('Hóa đơn đã thay đổi; hãy tải lại.');
    return row;
  }
  updateInvoice(input) {
    const v = invoiceInput(input);
    return this.db.transaction(() => {
      const old = this.editable(input.id, input.revision);
      const customerId = this.customerFor(v, input);
      this.db.prepare('UPDATE invoices SET customer_id=?,invoice_date=?,due_date=?,total=?,note=?,customer_name=?,customer_phone=?,customer_address=?,revision=revision+1,updated_at=? WHERE id=?').run(customerId, v.date, v.due || null, v.total, v.note,v.customer,v.phone,v.address,stamp(), old.id);
      this.db.prepare('DELETE FROM invoice_items WHERE invoice_id=?').run(old.id); this.writeItems(old.id, v.items);
      this.log('update', 'invoice', old.id, old, v); return old.id;
    })();
  }
  deleteInvoice(input) { return this.db.transaction(() => { const old = this.editable(input.id, input.revision); this.db.prepare('DELETE FROM invoices WHERE id=?').run(old.id); this.log('delete', 'invoice', old.id, old, null); return old.id; })(); }
  insertPayment(input, batchId = null) {
      const id = clean(input.invoice, 100), day = date(input.date), amount = money(input.amount, true), method = clean(input.method, 50), note = clean(input.note, 1000);
      if (!['Tiền mặt', 'Chuyển khoản', 'Khác'].includes(method)) throw Error('Phương thức không hợp lệ.');
      const inv = this.db.prepare('SELECT invoice_date,total FROM invoices WHERE id=?').get(id);
      if (!inv) throw Error('Không tìm thấy hóa đơn.');
      if (day < inv.invoice_date) throw Error('Ngày thu trước ngày lập hóa đơn.');
      const paid = this.db.prepare('SELECT COALESCE(SUM(amount),0) AS n FROM payments WHERE invoice_id=?').get(id).n;
      if (amount > inv.total - paid) throw Error('Số thu vượt dư nợ.');
      const pid = input.id ? clean(input.id,100) : uid('PT'); this.db.prepare('INSERT INTO payments(id,invoice_id,pay_date,amount,method,note,created_at,import_batch_id) VALUES (?,?,?,?,?,?,?,?)').run(pid, id, day, amount, method, note, stamp(),batchId);
      this.log('create', 'payment', pid, null, { invoice: id, date: day, amount, method, note }); return pid;
  }
  addPayment(input) { return this.db.transaction(() => this.insertPayment(input))(); }
  planBulkPayment(customerId,amount){return bulkPlan(this.snapshot(true),customerId,amount);}
  addBulkPayment(input){return this.db.transaction(()=>{const plan=bulkPlan(this.snapshot(true),input.customerId,input.amount);if(Array.isArray(input.allocations)&&JSON.stringify(plan.allocations.map(x=>[x.invoice,x.amount]))!==JSON.stringify(input.allocations.map(x=>[x.invoice,x.amount])))throw Error('Dư nợ đã thay đổi. Xem lại phân bổ trước khi lưu.');const ids=plan.allocations.map(x=>this.insertPayment({invoice:x.invoice,date:input.date,amount:x.amount,method:input.method,note:input.note}));this.log('bulk_payment','customer',String(input.customerId),null,{ids,amount:plan.amount});return {ids,plan};})();}
  profile(customerId,from='',to='',tab='all'){return customerProfile(this.snapshot(),customerId,from,to,tab);}
  importHistory(){return this.db.prepare('SELECT id,source_name AS name,kind,strategy,counts_json AS counts,created_at AS date,undone_at AS undone FROM import_batches ORDER BY created_at DESC').all().map(x=>({...x,counts:JSON.parse(x.counts)}));}
  importCommit(preview,sourceName,kind,strategy){
    if(!['skip','update','new'].includes(strategy))throw Error('Cách xử lý trùng không hợp lệ.');
    if(preview.issues.some(x=>x.severity==='error'))throw Error('Dữ liệu còn lỗi. Hãy sửa file và kiểm tra lại.');
    const backup=this.backup('before-import');
    const batchId=uid('IMP'),undo={customers:[],invoices:[]},counts={invoices:0,payments:0,customers:0,skipped:0,updated:0},now=stamp();
    this.db.transaction(()=>{
      const existingCustomer=(name,phone)=>{const p=normalizePhone(phone);return p?this.db.prepare('SELECT * FROM customers WHERE normalized_phone=? ORDER BY id LIMIT 1').get(p):this.db.prepare('SELECT * FROM customers WHERE normalized_phone=? AND normalized_name=? ORDER BY id LIMIT 1').get('',normalizeName(name));};
      for(const c of preview.customers){const old=existingCustomer(c.name,c.phone);if(old&&strategy==='skip'){counts.skipped++;continue;}if(old&&strategy==='update'){undo.customers.push(old);this.updateCustomer({id:old.id,name:c.name,phone:c.phone,address:c.address,note:c.note});counts.updated++;continue;}this.insertCustomer({customer:c.name,phone:c.phone,address:c.address,customerNote:c.note},batchId);counts.customers++;}
      const remap=new Map();
      for(const i of preview.invoices){const old=i.id?this.db.prepare('SELECT * FROM invoices WHERE id=?').get(i.id):null;if(old&&strategy==='skip'){counts.skipped++;remap.set(i.id,null);continue;}if(old&&strategy==='update'){if(this.db.prepare('SELECT 1 FROM payments WHERE invoice_id=?').get(i.id))throw Error(`Hóa đơn ${i.id} đã có phiếu thu, không thể cập nhật.`);undo.invoices.push({row:old,items:this.db.prepare('SELECT * FROM invoice_items WHERE invoice_id=? ORDER BY sort_order').all(i.id)});const customerId=this.customerFor(i,{acceptSimilar:true,acceptExistingPhone:true,batchId});this.db.prepare('UPDATE invoices SET customer_id=?,invoice_date=?,due_date=?,total=?,note=?,customer_name=?,customer_phone=?,customer_address=?,revision=revision+1,updated_at=? WHERE id=?').run(customerId,i.date,i.due||null,i.total,i.note,i.customer,i.phone,i.address,now,i.id);this.db.prepare('DELETE FROM invoice_items WHERE invoice_id=?').run(i.id);this.writeItems(i.id,i.items);counts.updated++;remap.set(i.id,i.id);continue;}
        const customerId=this.customerFor(i,{acceptSimilar:true,acceptExistingPhone:true,batchId}),id=old||!i.id?this.nextInvoiceId():i.id;
        this.db.prepare('INSERT INTO invoices(id,customer_id,invoice_date,due_date,total,note,customer_name,customer_phone,customer_address,source,import_batch_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,customerId,i.date,i.due||null,i.total,i.note,i.customer,i.phone,i.address,'import',batchId,now,now);this.writeItems(id,i.items);this.observeInvoiceId(id);counts.invoices++;if(i.id)remap.set(i.id,id);
      }
      for(const p of preview.payments){const invoice=remap.has(p.invoice)?remap.get(p.invoice):p.invoice;if(!invoice){counts.skipped++;continue;}const exists=p.id&&this.db.prepare('SELECT 1 FROM payments WHERE id=?').get(p.id);if(exists&&strategy==='skip'){counts.skipped++;continue;}this.insertPayment({...p,invoice,id:exists?undefined:p.id||undefined},batchId);counts.payments++;}
      this.db.prepare('INSERT INTO import_batches(id,source_name,kind,strategy,counts_json,undo_json,created_at) VALUES (?,?,?,?,?,?,?)').run(batchId,sourceName,kind,strategy,JSON.stringify(counts),JSON.stringify(undo),now);
      this.log('import','batch',batchId,null,{sourceName,kind,strategy,counts});
    })();
    return {id:batchId,backup,counts};
  }
  undoLastImport(){const last=this.db.prepare('SELECT * FROM import_batches WHERE undone_at IS NULL ORDER BY created_at DESC LIMIT 1').get();if(!last)throw Error('Không có lần nhập để hoàn tác.');const undo=JSON.parse(last.undo_json);const newer=this.db.prepare('SELECT 1 FROM payments WHERE import_batch_id IS NULL AND created_at>? AND invoice_id IN (SELECT id FROM invoices WHERE import_batch_id=?) LIMIT 1').get(last.created_at,last.id);if(newer)throw Error('Có phiếu thu mới trên hóa đơn đã nhập; không thể hoàn tác an toàn.');return this.db.transaction(()=>{this.db.prepare('DELETE FROM payments WHERE import_batch_id=?').run(last.id);this.db.prepare('DELETE FROM invoices WHERE import_batch_id=?').run(last.id);for(const x of undo.invoices){const r=x.row;this.db.prepare('UPDATE invoices SET customer_id=?,invoice_date=?,due_date=?,total=?,note=?,customer_name=?,customer_phone=?,customer_address=?,revision=?,updated_at=? WHERE id=?').run(r.customer_id,r.invoice_date,r.due_date,r.total,r.note,r.customer_name,r.customer_phone,r.customer_address,r.revision,r.updated_at,r.id);this.db.prepare('DELETE FROM invoice_items WHERE invoice_id=?').run(r.id);for(const item of x.items)this.db.prepare('INSERT INTO invoice_items(id,invoice_id,name,unit,qty,price,amount,sort_order) VALUES (?,?,?,?,?,?,?,?)').run(item.id,item.invoice_id,item.name,item.unit,item.qty,item.price,item.amount,item.sort_order);}for(const c of undo.customers.slice().reverse())this.db.prepare('UPDATE customers SET name=?,phone=?,address=?,note=?,normalized_key=?,normalized_phone=?,normalized_name=?,updated_at=? WHERE id=?').run(c.name,c.phone,c.address,c.note,c.normalized_key,c.normalized_phone,c.normalized_name,c.updated_at,c.id);this.db.prepare('DELETE FROM customers WHERE import_batch_id=? AND id NOT IN (SELECT customer_id FROM invoices)').run(last.id);this.db.prepare('UPDATE import_batches SET undone_at=? WHERE id=?').run(stamp(),last.id);this.log('undo_import','batch',last.id,null,{source:last.source_name});return last.id;})();}
  snapshot(skipBackup=false) {
    if(!skipBackup)this.dailyBackup();
    const invoices = this.db.prepare(`SELECT i.*,COALESCE((SELECT SUM(amount) FROM payments p WHERE p.invoice_id=i.id),0) AS paid FROM invoices i ORDER BY i.invoice_date DESC,i.created_at DESC`).all().map(i => ({ id: i.id, customerId: i.customer_id, customer: i.customer_name || '', phone: i.customer_phone || '', address: i.customer_address || '', date: i.invoice_date, due: i.due_date || '', total: i.total, paid: i.paid, balance: i.total - i.paid, note: i.note || '', revision: i.revision, source:i.source, items: this.db.prepare('SELECT name,unit,qty,price,amount FROM invoice_items WHERE invoice_id=? ORDER BY sort_order').all(i.id) }));
    const payments = this.db.prepare('SELECT id,invoice_id AS invoice,pay_date AS date,amount,method,note FROM payments ORDER BY pay_date DESC,created_at DESC').all();
    const customers = this.db.prepare('SELECT id,customer_code AS code,name,phone,address,note,normalized_key AS normalizedKey,normalized_phone AS normalizedPhone FROM customers ORDER BY name').all().map(c => { const related = invoices.filter(i => i.customerId === c.id); return { ...c, total: related.reduce((n, i) => n + i.total, 0), paid: related.reduce((n, i) => n + i.paid, 0), balance: related.reduce((n, i) => n + i.balance, 0) }; }).sort((a,b) => b.balance - a.balance);
    const today = new Date().toLocaleDateString('en-CA');
    for (const i of invoices) i.status = status(i, today);
    return { invoices, payments, customers, today, settings: this.settings(), dbPath: this.file, dataFolder: this.folder,importHistory:this.importHistory() };
  }
  reports(year, mode) { const s = this.snapshot(); const rows = periodReports(s.invoices, s.payments, year, mode); const top = s.customers.filter(x => x.balance > 0).slice(0, 5); return { rows, top }; }
  dashboard(){const s=this.snapshot(),base=new Date(s.today+'T00:00:00Z');const rows=Array.from({length:12},(_,n)=>{const d=new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth()-11+n,1)),year=d.getUTCFullYear(),month=d.getUTCMonth(),start=d.toISOString().slice(0,10),end=new Date(Date.UTC(year,month+1,0)).toISOString().slice(0,10);return {label:`${month+1}/${year}`,...report(s.invoices,s.payments,start,end)};});return {rows,current:rows.at(-1)};}
}
module.exports = { Store };
