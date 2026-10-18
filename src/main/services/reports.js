"use strict";
const invoices = require("./invoices");
const payments = require("./payments");
const customers = require("./customers");
const { integer } = require("./validate");
const today = () => new Date().toLocaleDateString("en-CA");
function summary(store, from, to) {
  const bills = invoices.list(store, { from, to }),
    receipts = payments.list(store, { from, to });
  return {
    invoices: bills.length,
    revenue: bills.reduce((n, r) => n + r.total, 0),
    collected: receipts.reduce((n, r) => n + r.amount, 0),
  };
}
function activity(store, page = 1) {
  const requested = integer(page, "Trang", 100000) || 1;
  const where = "a.entity IN ('invoice','payment','customer')";
  const total = store.get(
    `SELECT COUNT(*) count FROM audit_logs a WHERE ${where}`,
  ).count;
  const pages = Math.max(1, Math.ceil(total / 20)),
    current = Math.min(requested, pages);
  const rows = store.all(
    `SELECT a.*,CASE a.entity
    WHEN 'customer' THEN (SELECT name FROM customers WHERE id=CAST(a.entity_id AS INTEGER))
    WHEN 'invoice' THEN (SELECT c.name FROM invoices i JOIN customers c ON c.id=i.customer_id WHERE i.id=a.entity_id)
    WHEN 'payment' THEN (SELECT c.name FROM payments p JOIN invoices i ON i.id=p.invoice_id JOIN customers c ON c.id=i.customer_id WHERE p.id=a.entity_id)
    END subject_name FROM audit_logs a WHERE ${where} ORDER BY a.id DESC LIMIT 20 OFFSET ?`,
    (current - 1) * 20,
  );
  return { rows, total, page: current, pages };
}
function dashboard(store, date = today()) {
  const month = String(date).slice(0, 7),
    from = `${month}-01`,
    to = `${month}-31`;
  const bills = invoices.list(store),
    debt = bills.reduce((n, r) => n + r.balance, 0);
  const monthBills = bills.filter(
    (r) => r.invoice_date >= from && r.invoice_date <= to,
  );
  const monthTotal = monthBills.reduce((n, r) => n + r.total, 0);
  const collectionRate = monthTotal
    ? Math.round(
        (monthBills.reduce((n, r) => n + r.paid, 0) / monthTotal) * 100,
      )
    : 0;
  const overdue = bills.filter((r) => r.status === "overdue");
  const top = customers
    .list(store)
    .filter((r) => r.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 5)
    .map((c) => ({
      ...c,
      overdueBalance: overdue
        .filter((r) => r.customer_id === c.id)
        .reduce((n, r) => n + r.balance, 0),
    }));
  const chart = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(`${from}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - i);
    const key = d.toISOString().slice(0, 7);
    chart.push({ period: key, ...summary(store, `${key}-01`, `${key}-31`) });
  }
  const billedTotal = bills.reduce((n, r) => n + r.total, 0);
  return {
    month,
    ...summary(store, from, to),
    debt,
    collectionRate,
    allCollectionRate: billedTotal
      ? Math.round(((billedTotal - debt) / billedTotal) * 100)
      : 0,
    openCount: bills.filter((r) => r.balance > 0).length,
    overdue: overdue.reduce((n, r) => n + r.balance, 0),
    overdueCount: overdue.length,
    top,
    due: bills
      .filter((r) => r.balance > 0)
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .slice(0, 5),
    activity: activity(store).rows.slice(0, 5),
    chart,
  };
}
function periods(store, year, mode = "month") {
  const y = integer(year, "Năm", 9999);
  const rows = [];
  const years = mode === "year" ? [y - 2, y - 1, y] : [y];
  for (const yr of years) {
    for (let m = 1; m <= (mode === "year" ? 1 : 12); m++) {
      const from =
        mode === "year"
          ? `${yr}-01-01`
          : `${yr}-${String(m).padStart(2, "0")}-01`;
      const to =
        mode === "year"
          ? `${yr}-12-31`
          : `${yr}-${String(m).padStart(2, "0")}-31`;
      const s = summary(store, from, to);
      const billed = invoices
        .list(store)
        .filter((r) => r.invoice_date <= to)
        .reduce((n, r) => n + r.total, 0);
      const collected = payments
        .list(store)
        .filter((r) => r.pay_date <= to)
        .reduce((n, r) => n + r.amount, 0);
      rows.push({
        period:
          mode === "year" ? String(yr) : `${yr}-${String(m).padStart(2, "0")}`,
        ...s,
        closingDebt: billed - collected,
      });
    }
  }
  return rows;
}
function monthDetail(store, month) {
  const key = String(month).slice(0, 7),
    from = `${key}-01`,
    to = `${key}-31`;
  const monthBills = invoices.list(store, { from, to }),
    monthPayments = payments.list(store, { from, to });
  const billed = invoices
    .list(store)
    .filter((row) => row.invoice_date <= to)
    .reduce((sum, row) => sum + row.total, 0);
  const received = payments
    .list(store)
    .filter((row) => row.pay_date <= to)
    .reduce((sum, row) => sum + row.amount, 0);
  const value = monthBills.reduce((sum, row) => sum + row.total, 0);
  const rate = value
    ? Math.round(
        (monthBills.reduce((sum, row) => sum + row.paid, 0) / value) * 100,
      )
    : 0;
  return {
    month: key,
    summary: summary(store, from, to),
    invoices: monthBills,
    payments: monthPayments,
    closingDebt: billed - received,
    collectionRate: rate,
  };
}
module.exports = { summary, dashboard, periods, monthDetail, activity };
