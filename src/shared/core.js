'use strict';
const MAX_MONEY = 1_000_000_000_000;
function clean(v, max = 500) { const s = String(v ?? '').trim(); if (s.length > max) throw Error('Nội dung quá dài.'); return s; }
function money(v, positive = false) { const n = Number(v); if (!Number.isSafeInteger(n) || n < (positive ? 1 : 0) || n > MAX_MONEY) throw Error('Số tiền không hợp lệ.'); return n; }
function date(v, optional = false) { if (optional && !v) return ''; const s = clean(v, 10); const d = new Date(s + 'T00:00:00Z'); if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(d.valueOf()) || d.toISOString().slice(0, 10) !== s) throw Error('Ngày không hợp lệ.'); return s; }
function key(name, phone) { return JSON.stringify([clean(name, 200).replace(/\s+/g, ' ').toLocaleLowerCase('vi'), clean(phone, 40).replace(/\s+/g, '')]); }
function normalizeName(value) { return clean(value, 200).replace(/\s+/g, ' ').toLocaleLowerCase('vi'); }
function normalizePhone(value) { let digits=clean(value,40).replace(/\D/g,''); if(digits.startsWith('84')&&digits.length>=10)digits='0'+digits.slice(2); return digits; }
function matchKey(name, phone) { const p=normalizePhone(phone); return p?`p:${p}`:`n:${normalizeName(name)}`; }
function invoiceInput(d) {
  if (!d || typeof d !== 'object') throw Error('Thiếu dữ liệu hóa đơn.');
  const customer = clean(d.customer, 200), phone = clean(d.phone, 40), address = clean(d.address, 500);
  if (!customer) throw Error('Nhập tên khách hàng.');
  const invoiceDate = date(d.date), due = date(d.due, true);
  if (due && due < invoiceDate) throw Error('Hạn trả trước ngày lập.');
  if (!Array.isArray(d.items) || d.items.length < 1 || d.items.length > 100) throw Error('Cần 1–100 mặt hàng.');
  const items = d.items.map(x => { const name = clean(x.name, 200), unit = clean(x.unit, 40), qty = Number(x.qty), price = money(x.price); if (!name || !Number.isFinite(qty) || qty <= 0 || qty > 1e6) throw Error('Mặt hàng hoặc số lượng không hợp lệ.'); return { name, unit, qty, price, amount: money(Math.round(qty * price)) }; });
  const total = money(items.reduce((sum, x) => sum + x.amount, 0), true);
  return { customer, phone, address, date: invoiceDate, due, note: clean(d.note, 1000), items, total, normalizedKey: key(customer, phone) };
}
function status(i, today) { if (!i.balance) return 'Đã thanh toán'; if (i.due && i.due < today) return `Quá hạn ${Math.round((Date.parse(today) - Date.parse(i.due)) / 86400000)} ngày`; return i.paid ? 'Trả một phần' : 'Còn nợ'; }
function report(invoices, payments, start, end) {
  const period = invoices.filter(i => i.date >= start && i.date <= end);
  const revenue = period.reduce((n, i) => n + i.total, 0);
  const collected = payments.filter(p => p.date >= start && p.date <= end).reduce((n, p) => n + p.amount, 0);
  const closingDebt = invoices.filter(i => i.date <= end).reduce((n, i) => n + i.total, 0) - payments.filter(p => p.date <= end).reduce((n, p) => n + p.amount, 0);
  return { start, end, invoiceCount: period.length, revenue, collected, closingDebt, collectRate: revenue ? collected / revenue * 100 : 0, invoices: period };
}
function periodReports(invoices, payments, year, mode) {
  const y = Number(year); if (!Number.isInteger(y) || y < 1900 || y > 9999) throw Error('Năm không hợp lệ.');
  if (mode === 'year') return Array.from({ length: 5 }, (_, n) => { const v = y - 4 + n; return { label: String(v), ...report(invoices, payments, `${v}-01-01`, `${v}-12-31`) }; });
  return Array.from({ length: 12 }, (_, n) => { const m = String(n + 1).padStart(2, '0'); return { label: `Tháng ${n + 1}`, ...report(invoices, payments, `${y}-${m}-01`, `${y}-${m}-31`) }; });
}
module.exports = { clean, money, date, key, normalizeName, normalizePhone, matchKey, invoiceInput, status, report, periodReports };
