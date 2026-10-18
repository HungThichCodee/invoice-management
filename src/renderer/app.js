import {
  api,
  bindNonnegative,
  bindDateDisplays,
  esc,
  displayName,
  money,
  dateText,
  icon,
  button,
  today,
} from "./ui.js";
import { shell, applyBrand } from "./shell.js";
import { createInteractions } from "./interactions.js";
import * as dashboard from "./pages/dashboard.js";
import * as activity from "./pages/activity.js";
import * as invoices from "./pages/invoices.js";
import * as invoiceForm from "./pages/invoiceForm.js";
import * as customers from "./pages/customers.js";
import * as customerProfile from "./pages/customerProfile.js";
import * as debts from "./pages/debts.js";
import * as payments from "./pages/payments.js";
import * as reports from "./pages/reports.js";
import * as reportDetail from "./pages/reportDetail.js";
import * as imports from "./pages/imports.js";
import * as backups from "./pages/backups.js";
import * as settings from "./pages/settings.js";

const pages = {
  dashboard,
  activity,
  invoices,
  invoiceForm,
  customers,
  customerProfile,
  debts,
  payments,
  reports,
  reportDetail,
  imports,
  backups,
  settings,
};
const root = document.getElementById("app");
const state = { route: "dashboard", args: {}, busy: false, version: 0, brand: {} };
let navigating = false;
function activateRoute(route) {
  const selected = { invoiceForm: "invoices", customerProfile: "customers",
    reportDetail: "reports" }[route] || route;
  for (const link of root.querySelectorAll(".nav-item"))
    link.classList.toggle("active", link.dataset.route === selected);
}
function setBranding(settings) {
  state.brand = { sellerName: settings.sellerName, logoData: settings.logoData };
  applyBrand(state.brand);
}
let toastTimer;
function toast(message, error = false) {
  const box = document.getElementById("toast-root");
  if (!box) return;
  box.innerHTML = `<div class="toast ${error ? "error" : ""}"></div>`;
  box.firstElementChild.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (box) box.innerHTML = "";
  }, 4500);
}
const flow = createInteractions(toast);
window.__invoiceHasPendingChanges = () => flow.isDirty() || flow.isPending();
window.__invoiceIsSaving = () => flow.isPending();
const ctx = {
  api,
  state,
  toast,
  modal: flow.modal,
  closeModal: flow.closeModal,
  confirm: flow.ask,
  perform: flow.perform,
  trackPage: flow.trackPage,
  markPageDirty: flow.markPage,
  resetPageDirty: flow.resetPage,
  hasChanges: flow.isDirty,
  syncSavedField: flow.syncSavedField,
  setBranding,
  refreshBranding: async () => setBranding(await api["settings.get"]()),
  navigate,
  refresh: () => navigate(state.route, state.args, { history: false, preserveScroll: true }),
};
async function navigate(route, args = {}, options = {}) {
  if (!pages[route]) route = "dashboard";
  if (navigating) return false;
  navigating = true;
  const previous = { route: state.route, args: state.args };
  const scrollY = window.scrollY;
  const page = root.querySelector("#page");
  try {
    if (!options.force && !(await flow.leave())) return false;
    if (state.version && route !== state.route &&
        (await pages[state.route].onLeave?.(ctx)) === false) return false;
    await flow.closeModal(true);
    if (page) page.inert = true;
    state.route = route;
    state.args = args;
    const html = await pages[route].render(ctx, args);
    if (page) {
      const next = document.createElement("main");
      next.id = "page";
      next.className = page.className;
      next.innerHTML = html;
      page.replaceWith(next);
      activateRoute(route);
      const search = document.getElementById("globalSearch");
      if (search) search.value = "";
      document.getElementById("searchSuggestions")?.classList.add("hidden");
    } else root.innerHTML = shell(route, html, "", state.brand);
    flow.resetPage();
    if (options.history !== false && state.version)
      history.pushState({ route, args }, "", `#${route}`);
    state.version++;
    pages[route].bind?.(document.getElementById("page"), ctx, args);
    window.scrollTo(0, options.preserveScroll ? scrollY : 0);
    return true;
  } catch (error) {
    state.route = previous.route;
    state.args = previous.args;
    if (!page) {
      root.innerHTML = shell(route,
        '<div class="card danger"><h2>Không tải được dữ liệu</h2><p></p></div>',
        "", state.brand);
      root.querySelector(".card p").textContent = error.message;
    }
    toast(error.message, true);
    return false;
  } finally {
    if (page?.isConnected) page.inert = false;
    navigating = false;
  }
}
history.replaceState({ route: "dashboard", args: {} }, "", "#dashboard");
history.pushState({ route: "dashboard", args: {} }, "", "#dashboard");
window.addEventListener("popstate", async (event) => {
  const previous = { route: state.route, args: state.args };
  const next = event.state || { route: "dashboard", args: {} };
  if (!(await navigate(next.route, next.args, { history: false })))
    history.pushState(previous, "", `#${previous.route}`);
});
window.addEventListener("beforeunload", (event) => {
  if (window.__invoiceExitApproved) return;
  if (!flow.isDirty() && !flow.isPending()) return;
  event.preventDefault();
  event.returnValue = "";
});
document.addEventListener("click", async (e) => {
  const searchCustomer = e.target.closest("[data-search-customer]");
  if (searchCustomer) {
    navigate("customerProfile", {
      id: Number(searchCustomer.dataset.searchCustomer),
    });
    return;
  }
  const route = e.target.closest("[data-route]");
  if (route) {
    e.preventDefault();
    navigate(
      route.dataset.route,
      ["invoices", "payments"].includes(route.dataset.route)
        ? { reset: true }
        : {},
    );
  }
  const theme = e.target.closest("[data-action=toggleTheme]");
  if (theme) {
    const next = !document.body.classList.contains("dark");
    const outcome = await ctx.perform(theme, {
      title: "Đổi giao diện?", message: "Lưu giao diện hiển thị mới?",
      label: "Đổi giao diện", loading: "Đang lưu…",
      success: "Cập nhật giao diện thành công.",
    }, () => api["settings.update"]({ darkMode: String(next) }));
    if (outcome.ok) {
      document.body.classList.toggle("dark", next);
      ctx.syncSavedField("darkMode", next);
    }
  }
  if (e.target.closest("#notificationsButton")) showReminders();
  if (!e.target.closest(".search-wrap"))
    document.getElementById("searchSuggestions")?.classList.add("hidden");
});
async function showReminders() {
  try {
    const date = new Date(`${today()}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 7);
    const limit = date.toISOString().slice(0, 10);
    const bills = (await api["invoices.list"]({}))
      .filter((i) => i.balance > 0 && i.due_date <= limit)
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
    ctx.modal(
      `<div class="modal-head"><h2>Nhắc nợ nội bộ</h2>${button(icon("close"), "close", "icon-only white", "data-close")}</div>
      <p class="subtitle">Hóa đơn quá hạn hoặc đến hạn trong 7 ngày tới</p>${bills.length ? bills.map((i) => `<div class="activity"><div style="flex:1"><strong>${esc(i.id)} · ${esc(i.customer_name)}</strong><div class="small muted">Hạn ${dateText(i.due_date)} · Còn ${money(i.balance)}</div></div>${button("Sao chép lời nhắc", `copy:${i.id}`, "compact")}</div>`).join("") : '<div class="empty">Không có hóa đơn cần nhắc.</div>'}`,
      (box) =>
        box.addEventListener("click", async (event) => {
          const action = event.target.closest("[data-action]")?.dataset.action;
          if (!action?.startsWith("copy:")) return;
          const i = bills.find((x) => x.id === action.slice(5));
          if (!i) return;
          await api["reminders.copy"](
            `Kính gửi ${i.customer_name}, hóa đơn ${i.id} còn ${money(i.balance)}, hạn thanh toán ${dateText(i.due_date)}. Xin vui lòng kiểm tra và thanh toán. Trân trọng.`,
          );
          toast("Đã sao chép lời nhắc.");
        }),
    );
  } catch (error) {
    toast(error.message, true);
  }
}
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === "k") {
    e.preventDefault();
    document.getElementById("globalSearch")?.focus();
  }
  if (e.key === "Escape") {
    if (flow.hasConfirm()) flow.cancelConfirm();
    else flow.closeModal();
    document.getElementById("searchSuggestions")?.classList.add("hidden");
    document.getElementById("monthPopover")?.classList.add("hidden");
    document
      .getElementById("monthToggle")
      ?.setAttribute("aria-expanded", "false");
  }
  if (
    e.key === "Enter" &&
    e.target.id === "globalSearch" &&
    e.target.value.trim()
  ) {
    e.preventDefault();
    navigate("invoices", { search: e.target.value.trim() });
  }
});
let searchTimer = 0;
document.addEventListener("input", (e) => {
  if (e.target.id !== "globalSearch") return;
  clearTimeout(searchTimer);
  const query = e.target.value.trim(),
    panel = document.getElementById("searchSuggestions");
  if (!query) {
    panel.classList.add("hidden");
    return;
  }
  searchTimer = setTimeout(async () => {
    try {
      const customers = (await api["customers.list"](query)).slice(0, 6);
      if (
        !panel.isConnected ||
        document.getElementById("globalSearch")?.value.trim() !== query
      )
        return;
      panel.innerHTML = `<div class="search-caption">Khách hàng</div>${customers.map((c) => `<button type="button" data-search-customer="${c.id}"><strong>${esc(displayName(c.name))}</strong><span>${esc(c.code)}${c.phone ? ` · ${esc(c.phone)}` : ""}</span></button>`).join("") || '<div class="search-empty">Không tìm thấy khách hàng</div>'}<div class="search-hint">Nhấn Enter để tìm hóa đơn</div>`;
      panel.classList.remove("hidden");
    } catch (error) {
      toast(error.message, true);
    }
  }, 150);
});
bindNonnegative();
bindDateDisplays();
async function start() {
  try {
    const s = await api["settings.get"]();
    setBranding(s);
    if (s.darkMode === "true") document.body.classList.add("dark");
    document.body.dataset.fontSize = [13, 14, 15].includes(Number(s.fontSize))
      ? s.fontSize
      : "14";
  } catch (error) {
    toast(`Không tải được cài đặt: ${error.message}`, true);
  }
  await navigate("dashboard");
  await document.fonts.ready;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  await api["app.ready"]();
}
start().catch(async (error) => {
  toast(`Không mở được ứng dụng: ${error.message}`, true);
  await api["app.ready"]().catch(() => {});
});
