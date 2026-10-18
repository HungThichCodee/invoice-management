import {
  api,
  esc,
  displayName,
  money,
  dateText,
  icon,
  button,
  pill,
  empty,
  today,
} from "../ui.js";

let search = "",
  status = "all",
  month = "all",
  customerId = "all",
  page = 1,
  pages = 1;
const selected = new Set();
let visibleRows = [];
const monthLabel = (key) => `Tháng ${Number(key.slice(5))}/${key.slice(0, 4)}`;
const statusTabs = [
  ["all", "Tất cả"],
  ["open", "Chưa thu đủ"],
  ["overdue", "Quá hạn"],
  ["paid", "Đã thanh toán"],
];
function scoped(rows) {
  return rows.filter(
    (row) =>
      (month === "all" || row.invoice_date.startsWith(month)) &&
      (customerId === "all" || row.customer_id === Number(customerId)),
  );
}
function filtered(rows) {
  if (status === "open") return rows.filter((row) => row.balance > 0);
  return status === "all" ? rows : rows.filter((row) => row.status === status);
}
function dueText(row) {
  if (!row.balance) return "";
  const days = Math.round(
    (Date.parse(`${row.due_date}T00:00:00`) -
      Date.parse(`${today()}T00:00:00`)) /
      86400000,
  );
  const relative =
    days < 0
      ? `Quá hạn ${-days} ngày`
      : days === 0
        ? "Đến hạn hôm nay"
        : `Còn ${days} ngày`;
  return `<div class="small muted">Hạn ${dateText(row.due_date)} · ${relative}</div>`;
}
function rowHtml(row) {
  return `<tr class="clickable-row" data-detail-row="${esc(row.id)}">
    <td><input type="checkbox" class="row-check" value="${esc(row.id)}" aria-label="Chọn ${esc(row.id)}" ${selected.has(row.id) ? "checked" : ""}></td>
    <td><a href="#" class="blue strong" data-detail="${esc(row.id)}">${esc(row.id)}</a></td>
    <td>${dateText(row.invoice_date)}</td>
    <td><strong>${esc(displayName(row.customer_name))}</strong><div class="small muted">${esc(row.customer_phone)}</div></td>
    <td class="right strong">${money(row.total)}</td><td class="right green">${money(row.paid)}</td>
    <td class="right strong ${row.status === "overdue" ? "red" : ""}">${money(row.balance)}</td>
    <td>${pill(row.status)}${dueText(row)}</td>
    <td>${row.balance ? button("Thu tiền", `collect:${row.id}`, "compact") : ""}${button(icon("more_vert"), `detail:${row.id}`, "compact white", 'title="Xem chi tiết"')}</td>
  </tr>`;
}
export function exportFilter() {
  const filter = { search, status };
  if (month !== "all") {
    filter.from = `${month}-01`;
    filter.to = `${month}-31`;
  }
  if (customerId !== "all") filter.customerId = Number(customerId);
  if (selected.size) filter.ids = [...selected];
  return filter;
}
export async function renderList(args = {}) {
  if (args.reset) {
    search = "";
    status = "all";
    month = "all";
    customerId = "all";
    page = 1;
    selected.clear();
  } else if (args.search || args.openId) {
    search = args.search || args.openId;
    status = "all";
    month = "all";
    customerId = "all";
    page = 1;
    selected.clear();
  }
  const [matching, clients] = await Promise.all([
    api["invoices.list"]({ search }),
    api["customers.list"](""),
  ]);
  const scope = scoped(matching),
    rows = filtered(scope),
    size = 12;
  pages = Math.max(1, Math.ceil(rows.length / size));
  page = Math.min(page, pages);
  visibleRows = rows.slice((page - 1) * size, page * size);
  const counts = {
    all: scope.length,
    open: scope.filter((row) => row.balance > 0).length,
    overdue: scope.filter((row) => row.status === "overdue").length,
    paid: scope.filter((row) => row.status === "paid").length,
  };
  const tabs = statusTabs
    .map(
      ([key, label]) =>
        `<button type="button" class="invoice-tab ${status === key ? "active" : ""}" data-status-tab="${key}">${label}<span>${counts[key]}</span></button>`,
    )
    .join("");
  const months = [
    ...new Set([
      today().slice(0, 7),
      ...matching.map((row) => row.invoice_date.slice(0, 7)),
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
  const customerOptions =
    `<option value="all">Tất cả khách hàng</option>` +
    clients
      .map(
        (c) =>
          `<option value="${c.id}" ${customerId === String(c.id) ? "selected" : ""}>${esc(displayName(c.name))}</option>`,
      )
      .join("");
  const start = rows.length ? (page - 1) * size + 1 : 0,
    end = Math.min(page * size, rows.length);
  const pageButtons = Array.from({ length: Math.min(5, pages) }, (_, index) => {
    const first = Math.max(1, Math.min(page - 2, pages - 4)),
      number = first + index;
    return button(
      String(number),
      `page:${number}`,
      `compact ${number === page ? "primary" : "white"}`,
    );
  }).join("");
  return `<div class="page-head invoice-head"><div><h1>Hóa đơn <span class="invoice-count">${matching.length} hóa đơn</span></h1><p class="subtitle">Quản lý hóa đơn dịch vụ & phụ tùng</p></div>
    <div class="page-actions">${button(`${icon("picture_as_pdf")} PDF`, "pdf")}${button(`${icon("table_view")} Excel`, "excel")}${button(`${icon("description")} CSV`, "csv")}${button(`${icon("add")} Tạo hóa đơn`, "new", "primary")}</div></div>
    <div class="invoice-tabs">${tabs}</div>
    <section class="card invoice-list-card"><div class="invoice-filters"><label class="invoice-search">${icon("search")}<input type="search" id="search" placeholder="Mã HĐ, tên khách, SĐT…" value="${esc(search)}"></label>
      <label class="invoice-select">${icon("calendar_month")}<select id="invoiceMonth" aria-label="Lọc theo tháng">${monthOptions}</select></label>
      <label class="invoice-select">${icon("apartment")}<select id="invoiceCustomer" aria-label="Lọc khách hàng">${customerOptions}</select></label>
      ${button(icon("refresh"), "reset", "icon-only white", 'title="Xóa bộ lọc" aria-label="Xóa bộ lọc"')}
      <span id="selectionCount" class="pill ${selected.size ? "" : "hidden"}">Đã chọn ${selected.size}</span></div>
    <div class="table-wrap"><table class="invoice-table"><thead><tr><th><input type="checkbox" id="selectAll" aria-label="Chọn tất cả trên trang" ${visibleRows.length && visibleRows.every((row) => selected.has(row.id)) ? "checked" : ""}></th>
      <th>Mã HĐ</th><th>Ngày lập</th><th>Khách hàng</th><th class="right">Tổng tiền</th><th class="right">Đã thu</th><th class="right">Còn nợ</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
      <tbody>${visibleRows.map(rowHtml).join("") || `<tr><td colspan="9">${empty("Chưa có hóa đơn phù hợp")}</td></tr>`}</tbody></table></div>
    <div class="invoice-pager"><span>Hiển thị ${start}–${end} / ${rows.length} hóa đơn</span><div class="pagination">
      ${button(icon("chevron_left"), "prev", "compact white", page <= 1 ? "disabled" : "")}${pageButtons}${button(icon("chevron_right"), "next", "compact white", page >= pages ? "disabled" : "")}</div></div></section>`;
}
export function bindList(root, ctx) {
  root.addEventListener("change", (event) => {
    const target = event.target;
    if (target.id === "search") {
      search = target.value;
      page = 1;
      selected.clear();
      ctx.refresh();
    }
    if (target.id === "invoiceMonth") {
      month = target.value;
      page = 1;
      selected.clear();
      ctx.refresh();
    }
    if (target.id === "invoiceCustomer") {
      customerId = target.value;
      page = 1;
      selected.clear();
      ctx.refresh();
    }
    if (target.id === "selectAll") {
      for (const row of visibleRows)
        target.checked ? selected.add(row.id) : selected.delete(row.id);
      root.querySelectorAll(".row-check").forEach((box) => {
        box.checked = target.checked;
      });
    }
    if (target.classList.contains("row-check")) {
      target.checked
        ? selected.add(target.value)
        : selected.delete(target.value);
      root.querySelector("#selectAll").checked =
        visibleRows.length > 0 &&
        visibleRows.every((row) => selected.has(row.id));
    }
    const count = root.querySelector("#selectionCount");
    count.textContent = `Đã chọn ${selected.size}`;
    count.classList.toggle("hidden", !selected.size);
  });
  root.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-status-tab]");
    if (tab) {
      status = tab.dataset.statusTab;
      page = 1;
      selected.clear();
      ctx.refresh();
      return;
    }
    const numbered = event.target.closest('[data-action^="page:"]');
    if (numbered) {
      page = Number(numbered.dataset.action.slice(5));
      ctx.refresh();
      return;
    }
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "reset") ctx.navigate("invoices", { reset: true });
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
