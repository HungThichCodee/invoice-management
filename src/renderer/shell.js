import { icon, esc } from "./ui.js";
const links = [
  ["dashboard", "dashboard", "Tổng quan"],
  ["invoices", "receipt_long", "Hóa đơn"],
  ["debts", "account_balance", "Công nợ"],
  ["customers", "group", "Khách hàng"],
  ["payments", "payments", "Thu tiền"],
  ["reports", "bar_chart", "Báo cáo"],
  ["imports", "swap_vert", "Nhập / Xuất"],
  ["backups", "verified_user", "Sao lưu"],
  ["settings", "settings", "Cài đặt"],
];
function brand(settings = {}) {
  const name = String(settings.sellerName || "").trim() || "Xe Nâng Minh Phát";
  const logo = settings.logoData
    ? `<img src="${esc(settings.logoData)}" alt="Logo ${esc(name)}">`
    : icon("forklift");
  return { name, logo };
}
export function applyBrand(settings) {
  const { name, logo } = brand(settings);
  const image = document.querySelector(".brand-logo");
  if (image) image.innerHTML = logo;
  for (const selector of [".brand-title", ".topbar-title"]) {
    const title = document.querySelector(selector);
    if (title) { title.textContent = name; title.title = name; }
  }
  document.title = `${name} · Hóa đơn xe nâng`;
}
export function shell(route, content, backupLabel = "", settings = {}) {
  const { name, logo } = brand(settings);
  const nav = links
    .map(
      (
        [id, glyph, label],
        index,
      ) => `${index === 0 || index === 6 || index === 8 ? `<div class="side-label">${index === 0 ? "CHÍNH" : index === 6 ? "DỮ LIỆU" : "HỆ THỐNG"}</div>` : ""}
    <a href="#${id}" class="nav-item ${route === id || (route === "invoiceForm" && id === "invoices") || (route === "customerProfile" && id === "customers") || (route === "reportDetail" && id === "reports") ? "active" : ""}" data-route="${id}">${icon(glyph)}<span>${label}</span></a>`,
    )
    .join("");
  return `<aside class="sidebar"><div class="brand"><div class="brand-logo">${logo}</div><div class="brand-details"><div class="brand-title" title="${esc(name)}">${esc(name)}</div><div class="brand-sub">Phần mềm quản lý</div></div></div>
    <div class="side-scroll"><button class="button primary side-create" data-route="invoiceForm">${icon("add")} Tạo hóa đơn</button>${nav}</div>
    <div class="sidebar-foot"><div>${icon("check_circle")} ${esc(backupLabel || "Dữ liệu lưu trên máy này")}</div><button type="button" class="theme-switch" data-action="toggleTheme" aria-label="Đổi giao diện sáng tối"><span>${icon("light_mode")} <span class="theme-label-light">Giao diện sáng</span><span class="theme-label-dark">Giao diện tối</span></span><span class="switch-track"><span></span></span></button></div></aside>
    <div class="workspace"><header class="topbar"><div class="topbar-title" title="${esc(name)}">${esc(name)}</div>
    <div class="top-actions"><div class="search-wrap">${icon("search")}<input class="top-search" type="search" id="globalSearch" placeholder="Tìm khách hàng, SĐT, mã hóa đơn…" autocomplete="off"><kbd>Ctrl K</kbd><div class="search-suggestions hidden" id="searchSuggestions"></div></div><button type="button" class="button icon-only white" id="notificationsButton" title="Nhắc nợ nội bộ">${icon("notifications")}</button><div class="avatar" aria-hidden="true">${icon("person")}</div><span class="small">Quản trị viên</span></div></header>
    <main class="content" id="page">${content}</main></div>`;
}
