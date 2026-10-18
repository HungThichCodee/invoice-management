"use strict";
const { clean, fail, integer, milli, isoDate } = require("./validate");
const { classify } = require("./importRead");
function subtotalForTotal(total, taxRate, discount) {
  const target = integer(total || 0, "Tổng tiền", 1000000000000);
  const tax = integer(taxRate || 0, "Thuế", 100);
  const rebate = integer(discount || 0, "Chiết khấu", 1000000000000);
  const guess = Math.round((target + rebate) / (1 + tax / 100));
  for (let offset = -4; offset <= 4; offset++) {
    const base = guess + offset;
    if (
      base >= 0 &&
      base <= 1000000000000 &&
      base + Math.round((base * tax) / 100) - rebate === target
    )
      return base;
  }
  fail(
    "Không thể giữ đúng tổng tiền và thuế khi thiếu dòng chi tiết; hãy bổ sung chi tiết hóa đơn.",
  );
}
function preview(sheets, store = null) {
  const groups = {
      invoices: [],
      details: [],
      payments: [],
      customers: [],
      vehicles: [],
      parts: [],
    },
    issues = [];
  for (const sheet of sheets) {
    const type = classify(sheet.name, sheets.length === 1);
    if (type)
      groups[type].push(
        ...sheet.rows.map((x) => ({ ...x, _sheet: sheet.name })),
      );
  }
  if (!Object.values(groups).some((x) => x.length))
    issues.push({
      sheet: "",
      line: 1,
      message: "Không tìm thấy sheet dữ liệu hỗ trợ.",
      severity: "error",
    });
  const check = (row, fn) => {
    try {
      fn();
    } catch (e) {
      issues.push({
        sheet: row._sheet,
        line: row._line,
        message: e.message,
        severity: "error",
      });
    }
  };
  for (const r of groups.customers) {
    check(r, () => {
      if (!clean(r.customer || r.name)) fail("Thiếu tên khách hàng.");
    });
    if (clean(r.customer || r.name) && !clean(r.phone))
      issues.push({
        sheet: r._sheet,
        line: r._line,
        message: "Thiếu số điện thoại liên hệ; có thể bổ sung sau.",
        severity: "warning",
      });
  }
  for (const r of groups.invoices)
    check(r, () => {
      if (!clean(r.customer)) fail("Thiếu khách hàng.");
      const date = isoDate(r.date, "Ngày hóa đơn");
      if (r.due && isoDate(r.due, "Hạn thanh toán") < date)
        fail("Hạn thanh toán phải sau ngày hóa đơn.");
      integer(r.total || 0, "Tổng tiền", 1000000000000);
      integer(r.taxRate || 0, "Thuế", 100);
      integer(r.discount || 0, "Chiết khấu", 1000000000000);
      if (!groups.details.some((d) => clean(d.invoice) === clean(r.code)))
        subtotalForTotal(r.total, r.taxRate, r.discount);
    });
  for (const r of groups.invoices)
    if (r.date && !clean(r.due))
      issues.push({
        sheet: r._sheet,
        line: r._line,
        message: "Chưa có hạn thanh toán; sẽ dùng ngày hóa đơn.",
        severity: "warning",
      });
  for (const r of groups.details)
    check(r, () => {
      if (!clean(r.invoice)) fail("Thiếu mã hóa đơn ở dòng chi tiết.");
      if (!clean(r.name)) fail("Thiếu tên mặt hàng.");
      if (milli(r.qty, "Số lượng") <= 0) fail("Số lượng phải lớn hơn 0.");
      integer(r.price, "Đơn giá", 1000000000000);
      integer(r.capacity || 0, "Trọng tải");
      milli(r.hours || 0, "Số giờ");
    });
  for (const r of groups.payments)
    check(r, () => {
      if (!clean(r.invoice)) fail("Thiếu mã hóa đơn.");
      isoDate(r.date, "Ngày thu");
      if (integer(r.amount, "Số tiền", 1000000000000) <= 0)
        fail("Số tiền phải lớn hơn 0.");
    });
  for (const r of [...groups.vehicles, ...groups.parts])
    check(r, () => {
      if (!clean(r.name)) fail("Thiếu tên xe hoặc phụ tùng.");
      integer(r.capacity || 0, "Trọng tải");
      milli(r.hours || 0, "Số giờ");
      integer(r.price || 0, "Đơn giá", 1000000000000);
    });
  const codes = new Set(
    groups.invoices.map((r) => clean(r.code)).filter(Boolean),
  );
  const exists = (id) =>
    codes.has(clean(id)) ||
    !!store?.get("SELECT 1 FROM invoices WHERE id=?", clean(id));
  for (const r of groups.details)
    if (clean(r.invoice) && !exists(r.invoice))
      issues.push({
        sheet: r._sheet,
        line: r._line,
        message: `Không có hóa đơn ${r.invoice} cho dòng chi tiết.`,
        severity: "error",
      });
  for (const r of groups.payments)
    if (clean(r.invoice) && !exists(r.invoice))
      issues.push({
        sheet: r._sheet,
        line: r._line,
        message: `Không có hóa đơn ${r.invoice} cho phiếu thu.`,
        severity: "error",
      });
  const seen = new Set();
  for (const r of groups.invoices)
    if (clean(r.code)) {
      if (seen.has(clean(r.code)))
        issues.push({
          sheet: r._sheet,
          line: r._line,
          message: `Mã hóa đơn ${r.code} bị lặp trong file.`,
          severity: "error",
        });
      seen.add(clean(r.code));
    }
  for (const r of groups.invoices)
    if (clean(r.code)) {
      const details = groups.details.filter(
        (d) => clean(d.invoice) === clean(r.code),
      );
      if (
        details.length &&
        details.every((d) => Number(d.qty) > 0 && Number(d.price) >= 0)
      ) {
        const subtotal = details.reduce(
          (sum, d) => sum + Math.round(Number(d.qty) * Number(d.price)),
          0,
        );
        const calculated =
          subtotal +
          Math.round((subtotal * Number(r.taxRate || 0)) / 100) -
          Number(r.discount || 0);
        if (Number(r.total) !== calculated)
          issues.push({
            sheet: r._sheet,
            line: r._line,
            message: "Tổng hóa đơn khác tổng dòng hàng, thuế và chiết khấu.",
            severity: "error",
          });
      }
    }
  return {
    groups,
    issues,
    counts: Object.fromEntries(
      Object.entries(groups).map(([k, v]) => [k, v.length]),
    ),
  };
}
function skipInvalidRows(session, store) {
  let removed = 0;
  for (let pass = 0; pass < 10; pass++) {
    const result = preview(session.sheets, store);
    const errors = result.issues.filter((x) => x.severity !== "warning");
    if (!errors.length) return { ...result, removed };
    const bad = new Set(errors.map((x) => `${x.sheet}:${x.line}`));
    let changed = 0;
    for (const sheet of session.sheets) {
      const before = sheet.rows.length;
      sheet.rows = sheet.rows.filter(
        (row) => !bad.has(`${sheet.name}:${row._line}`),
      );
      changed += before - sheet.rows.length;
    }
    if (!changed)
      fail("Lỗi cấu trúc file không thể xử lý bằng cách bỏ qua dòng.");
    removed += changed;
  }
  fail("File còn lỗi sau khi bỏ qua dòng.");
}
module.exports = { subtotalForTotal, preview, skipInvalidRows };
