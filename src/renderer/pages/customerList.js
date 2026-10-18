import { api, esc, displayName, money, icon, button, empty } from "../ui.js";

let search = "",
  tab = "all",
  sort = "debt",
  region = "all",
  page = 1,
  pages = 1,
  filteredIds = [];
const initials = (name) =>
  String(name || "")
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((word) => word[0] || "")
    .join("")
    .toLocaleUpperCase("vi-VN");
const area = (address) =>
  String(address || "")
    .split(",")
    .at(-1)
    .trim();
function counts(rows, invoices) {
  const byCustomer = new Map();
  for (const bill of invoices) {
    const list = byCustomer.get(bill.customer_id) || [];
    list.push(bill);
    byCustomer.set(bill.customer_id, list);
  }
  return rows.map((c) => {
    const bills = byCustomer.get(c.id) || [];
    return {
      ...c,
      bills,
      overdue: bills
        .filter((bill) => bill.status === "overdue")
        .reduce((n, bill) => n + bill.balance, 0),
    };
  });
}
function rowHtml(c) {
  const paid = c.bills.filter((b) => b.status === "paid").length,
    partial = c.bills.filter((b) => b.status === "partial").length,
    overdue = c.bills.filter((b) => b.status === "overdue").length;
  const badges = [
    paid ? `<span class="customer-state paid">${paid} đã TT</span>` : "",
    partial
      ? `<span class="customer-state partial">${partial} trả một phần</span>`
      : "",
    overdue
      ? `<span class="customer-state overdue">${overdue} quá hạn</span>`
      : "",
    !c.bills.length ? '<span class="small muted">Chưa có hóa đơn</span>' : "",
  ].join("");
  return `<tr class="clickable-row" data-customer-row="${c.id}">
    <td><span class="customer-code">${esc(c.code)}</span></td>
    <td><div class="customer-identity"><span class="customer-avatar">${esc(initials(c.name))}</span><span><a href="#" data-profile="${c.id}" class="strong">${esc(displayName(c.name))}</a>
      <span class="small muted">${esc(c.phone)}${c.address ? ` · ${esc(c.address)}` : ""}</span></span></div></td>
    <td><span class="customer-bill-count">${c.bills.length} hóa đơn</span></td>
    <td class="right strong">${money(c.total)}</td><td class="right green strong">${money(c.paid)}</td>
    <td class="right strong ${c.balance ? "red" : ""}">${c.balance ? money(c.balance) : "—"}</td>
    <td><div class="customer-states">${badges}</div></td>
    <td>${button(icon("more_vert"), `edit:${c.id}`, "compact white", 'title="Sửa khách hàng"')}</td></tr>`;
}
export function exportFilter() {
  return { search, ids: filteredIds };
}
export async function renderList() {
  const [customers, invoices] = await Promise.all([
    api["customers.list"](search),
    api["invoices.list"]({}),
  ]);
  const all = counts(customers, invoices),
    total = all.reduce((n, c) => n + c.total, 0),
    debt = all.reduce((n, c) => n + c.balance, 0),
    overdue = all.reduce((n, c) => n + c.overdue, 0);
  const categories = {
    all: all.length,
    debt: all.filter((c) => c.balance > 0).length,
    overdue: all.filter((c) => c.overdue > 0).length,
  };
  const regionOptions = [
    ...new Set(all.map((c) => area(c.address)).filter(Boolean)),
  ].sort();
  let rows = all.filter(
    (c) =>
      (tab === "all" || (tab === "debt" ? c.balance > 0 : c.overdue > 0)) &&
      (region === "all" || area(c.address) === region),
  );
  rows.sort(
    sort === "name"
      ? (a, b) => a.name.localeCompare(b.name, "vi")
      : sort === "revenue"
        ? (a, b) => b.total - a.total
        : (a, b) => b.balance - a.balance,
  );
  filteredIds = rows.map((c) => c.id);
  pages = Math.max(1, Math.ceil(rows.length / 12));
  page = Math.min(page, pages);
  const visible = rows.slice((page - 1) * 12, page * 12),
    start = rows.length ? (page - 1) * 12 + 1 : 0,
    end = Math.min(page * 12, rows.length);
  const kpis = [
    ["Tổng khách hàng", String(all.length), "đối tác", "group", "blue"],
    [
      "Tổng doanh số lũy kế",
      money(total),
      `${invoices.length} hóa đơn`,
      "payments",
      "green",
    ],
    [
      "Tổng nợ chưa thu",
      money(debt),
      `${categories.debt} khách có số dư nợ`,
      "account_balance_wallet",
      "amber",
    ],
    [
      "Nợ quá hạn cần xử lý",
      money(overdue),
      overdue ? `${categories.overdue} khách quá hạn` : "Không có nợ quá hạn",
      overdue ? "warning" : "verified",
      overdue ? "red" : "green",
    ],
  ]
    .map(
      ([label, value, foot, glyph, tone]) =>
        `<div class="card customer-kpi ${tone === "red" && overdue ? "danger" : ""}"><div><span class="metric-label">${label}</span><div class="metric ${tone}">${value}</div><div class="small muted">${foot}</div></div><span class="metric-icon ${tone}">${icon(glyph)}</span></div>`,
    )
    .join("");
  const tabs = [
    ["all", "Tất cả"],
    ["debt", "Đang nợ"],
    ["overdue", "Quá hạn"],
  ]
    .map(
      ([key, label]) =>
        `<button type="button" class="invoice-tab ${tab === key ? "active" : ""}" data-customer-tab="${key}">${label}<span>${categories[key]}</span></button>`,
    )
    .join("");
  const regions =
    `<option value="all">Khu vực: Tất cả</option>` +
    regionOptions
      .map(
        (value) =>
          `<option value="${esc(value)}" ${region === value ? "selected" : ""}>${esc(value)}</option>`,
      )
      .join("");
  return `<div class="page-head customer-head"><div><h1>Khách hàng</h1><p class="subtitle">Quản lý thông tin đối tác và lịch sử hóa đơn xe nâng</p></div>
    <div class="page-actions">${button(`${icon("download")} Xuất Excel`, "excel")}${button(`${icon("add")} Thêm khách hàng`, "add", "primary")}</div></div>
    <div class="grid4 customer-kpis mb16">${kpis}</div>
    <section class="card customer-filter-card"><div class="customer-filters"><div class="customer-tabs">${tabs}</div>
      <label class="invoice-search">${icon("search")}<input id="customerSearch" type="search" placeholder="Tên, mã khách, số điện thoại…" value="${esc(search)}"></label>
      <label class="invoice-select">${icon("sort")}<select id="customerSort" aria-label="Sắp xếp khách hàng">
        <option value="debt" ${sort === "debt" ? "selected" : ""}>Công nợ cao nhất</option><option value="revenue" ${sort === "revenue" ? "selected" : ""}>Doanh số cao nhất</option><option value="name" ${sort === "name" ? "selected" : ""}>Tên khách hàng</option></select></label>
      <label class="invoice-select">${icon("location_on")}<select id="customerRegion" aria-label="Lọc khu vực">${regions}</select></label></div></section>
    <section class="card customer-table-card"><div class="table-wrap"><table class="customer-table"><thead><tr><th>Mã KH</th><th>Khách hàng</th><th>Số HĐ</th>
      <th class="right">Tổng mua</th><th class="right">Đã trả</th><th class="right">Còn nợ</th><th>Tình trạng hóa đơn</th><th></th></tr></thead>
      <tbody>${visible.map(rowHtml).join("") || `<tr><td colspan="8">${empty("Chưa có khách hàng phù hợp")}</td></tr>`}</tbody></table></div>
      <div class="invoice-pager"><span>Hiển thị ${start}–${end} / ${rows.length} khách hàng · Tổng công nợ ${money(debt)}</span>
        <div class="pagination">${button("Trước", "prev", "compact white", page <= 1 ? "disabled" : "")}<span>${page}/${pages}</span>${button("Sau", "next", "compact white", page >= pages ? "disabled" : "")}</div></div></section>`;
}
export function bindList(root, ctx) {
  root.querySelector("#customerSearch").addEventListener("change", (event) => {
    search = event.target.value;
    page = 1;
    ctx.refresh();
  });
  root.querySelector("#customerSort").addEventListener("change", (event) => {
    sort = event.target.value;
    page = 1;
    ctx.refresh();
  });
  root.querySelector("#customerRegion").addEventListener("change", (event) => {
    region = event.target.value;
    page = 1;
    ctx.refresh();
  });
  root.addEventListener("click", (event) => {
    const selected = event.target.closest("[data-customer-tab]");
    if (selected) {
      tab = selected.dataset.customerTab;
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
