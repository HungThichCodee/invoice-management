import {
  api,
  esc,
  displayName,
  money,
  dateText,
  dateTimeText,
  icon,
  button,
  empty,
  today,
} from "../ui.js";

let search = "",
  method = "all",
  sort = "new",
  page = 1,
  pages = 1,
  current = {};
const names = {
  all: "Tất cả",
  bank: "Chuyển khoản",
  cash: "Tiền mặt",
  other: "Khác",
};
const tabs = ["all", "bank", "cash", "other"];
const monthLabel = (key) => `Tháng ${Number(key.slice(5))}/${key.slice(0, 4)}`;
const valueOf = (rows) => rows.reduce((sum, row) => sum + row.amount, 0);
function period(args) {
  if (args.all) return "all";
  return args.from?.slice(0, 7) || today().slice(0, 7);
}
export function exportFilter() {
  return { ...current, search, method: method === "all" ? undefined : method };
}
function rowHtml(row) {
  const badge =
    row.method === "cash"
      ? "paid"
      : row.method === "bank"
        ? "partial"
        : "unpaid";
  const time = dateTimeText(row.created_at).split(" ")[1] || "";
  return `<tr><td><strong class="blue">${esc(row.id)}</strong></td>
    <td>${dateText(row.pay_date)}<div class="small muted">${time}</div></td>
    <td><strong>${esc(displayName(row.customer_name))}</strong></td>
    <td><span class="pill">${esc(row.invoice_id)}</span></td>
    <td class="right strong green">+${money(row.amount)}</td>
    <td><span class="pill ${badge}">${names[row.method]}</span></td>
    <td class="payment-note">${esc(row.note)}</td>
    <td class="payment-actions">${button("Sửa", `edit:${row.id}`, "compact white")}${button(icon("delete"), `delete:${row.id}`, "compact danger", 'title="Xóa phiếu thu"')}${button(icon("print"), `print:${row.id}`, "compact white", 'title="In phiếu thu"')}</td></tr>`;
}
export async function renderList(args = {}) {
  if (args.reset) {
    search = "";
    method = "all";
    sort = "new";
    page = 1;
  }
  const month = period(args),
    query = { search, invoiceId: args.invoiceId };
  if (month !== "all") {
    query.from = `${month}-01`;
    query.to = `${month}-31`;
  }
  current = { invoiceId: args.invoiceId, from: query.from, to: query.to };
  const [scoped, all] = await Promise.all([
    api["payments.list"](query),
    api["payments.list"]({ search, invoiceId: args.invoiceId }),
  ]);
  const counts = Object.fromEntries(
    tabs.map((key) => [
      key,
      key === "all"
        ? scoped.length
        : scoped.filter((row) => row.method === key).length,
    ]),
  );
  const filtered =
    method === "all" ? scoped : scoped.filter((row) => row.method === method);
  const rows = sort === "old" ? [...filtered].reverse() : filtered;
  pages = Math.max(1, Math.ceil(rows.length / 10));
  page = Math.min(page, pages);
  const shown = rows.slice((page - 1) * 10, page * 10),
    start = rows.length ? (page - 1) * 10 + 1 : 0,
    end = Math.min(page * 10, rows.length);
  const total = valueOf(scoped),
    cash = valueOf(scoped.filter((row) => row.method === "cash")),
    bank = valueOf(scoped.filter((row) => row.method === "bank")),
    other = valueOf(scoped.filter((row) => row.method === "other"));
  const kpis = [
    ["Thu trong kỳ", total, scoped.length, "account_balance_wallet", "blue"],
    ["Tiền mặt tại quỹ", cash, counts.cash, "payments", "green"],
    ["Chuyển khoản ngân hàng", bank, counts.bank, "credit_card", "blue"],
    ["Khác", other, counts.other, "swap_horiz", "amber"],
  ]
    .map(
      ([label, value, count, glyph, tone]) =>
        `<div class="card payment-kpi"><div class="flex gap"><div class="metric-icon ${tone}">${icon(glyph)}</div><span class="metric-label">${label}</span></div><div class="metric ${tone}">${money(value)}</div><div class="small muted">${count} phiếu · ${total ? Math.round((value / total) * 100) : 0}% tổng thu</div></div>`,
    )
    .join("");
  const months = [
    ...new Set([
      today().slice(0, 7),
      ...all.map((row) => row.pay_date.slice(0, 7)),
    ]),
  ]
    .sort()
    .reverse();
  const monthOptions =
    `<option value="all">Mọi tháng</option>` +
    months
      .map(
        (key) =>
          `<option value="${key}" ${month === key ? "selected" : ""}>${monthLabel(key)}</option>`,
      )
      .join("");
  const tabHtml = tabs
    .map(
      (key) =>
        `<button type="button" class="invoice-tab ${method === key ? "active" : ""}" data-method-tab="${key}">${names[key]}<span>${counts[key]}</span></button>`,
    )
    .join("");
  return `<div class="page-head payment-head"><div><h1>Thu tiền</h1><p class="subtitle">Quản lý dòng tiền thực thu từ khách hàng</p></div><div class="page-actions">
    ${button("Xuất Excel", "excel")}${button("In sổ quỹ PDF", "pdf")}${button(`${icon("add_circle")} Lập phiếu thu`, "create", "primary")}</div></div>
    <div class="grid4 payment-kpis mb16">${kpis}</div>
    <section class="card payment-filters"><div class="payment-filter-row"><label class="invoice-search">${icon("search")}<input type="search" id="paymentSearch" value="${esc(search)}" placeholder="Mã phiếu, HĐ, tên khách hàng, SĐT…"></label>
      <label class="invoice-select">${icon("calendar_month")}<select id="paymentMonth" aria-label="Lọc theo tháng">${monthOptions}</select></label>
      <label class="invoice-select">${icon("sort")}<select id="paymentSort" aria-label="Sắp xếp"><option value="new" ${sort === "new" ? "selected" : ""}>Mới nhất trước</option><option value="old" ${sort === "old" ? "selected" : ""}>Cũ nhất trước</option></select></label>
      ${args.from ? button("Xóa lọc kỳ", "clearPeriod", "compact white") : ""}</div>
      <div class="payment-tabs">${tabHtml}<span class="small muted">${scoped.length} chứng từ đã ghi nhận</span></div></section>
    <section class="card payment-table-card"><div class="table-wrap"><table class="payment-table"><thead><tr><th>Mã phiếu</th><th>Ngày thu</th><th>Khách hàng</th><th>Hóa đơn</th><th class="right">Số tiền thu</th><th>Phương thức</th><th>Ghi chú & thao tác</th><th></th></tr></thead>
      <tbody>${shown.map(rowHtml).join("") || `<tr><td colspan="8">${empty("Chưa có phiếu thu trong kỳ")}</td></tr>`}</tbody></table></div>
      <div class="invoice-pager"><span>Hiển thị ${start}–${end} / ${rows.length} phiếu thu</span><div class="pagination">
        ${button("Trước", "prev", "compact white", page <= 1 ? "disabled" : "")}<span>${page}/${pages}</span>${button("Sau", "next", "compact white", page >= pages ? "disabled" : "")}</div></div></section>
    <div class="payment-guidance">${icon("info")} <span><strong>Quy tắc kế toán dòng tiền:</strong> Một hóa đơn có thể thu nhiều lần; hệ thống không cho thu vượt dư nợ. Mọi phiếu thu được cập nhật vào báo cáo và công nợ.</span></div>`;
}
export function bindList(root, ctx, args) {
  root.querySelector("#paymentSearch").addEventListener("change", (event) => {
    search = event.target.value;
    page = 1;
    ctx.refresh();
  });
  root.querySelector("#paymentSort").addEventListener("change", (event) => {
    sort = event.target.value;
    page = 1;
    ctx.refresh();
  });
  root.querySelector("#paymentMonth").addEventListener("change", (event) => {
    const key = event.target.value;
    page = 1;
    ctx.navigate(
      "payments",
      key === "all" ? { all: true } : { from: `${key}-01`, to: `${key}-31` },
    );
  });
  root.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-method-tab]");
    if (tab) {
      method = tab.dataset.methodTab;
      page = 1;
      ctx.refresh();
      return;
    }
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "prev" && page > 1) {
      page--;
      ctx.refresh();
    }
    if (action === "next" && page < pages) {
      page++;
      ctx.refresh();
    }
  });
}
