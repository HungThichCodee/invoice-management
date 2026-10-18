import { api, esc, displayName, money, dateText, icon, button } from "../ui.js";
import { renderList, bindList, exportFilter } from "./invoiceList.js";
export async function render(ctx, args = {}) {
  if (args.reset || args.search || args.openId) ctx.state.args = {};
  return renderList(args);
}
async function detail(ctx, id) {
  const i = await api["invoices.get"](id);
  const items = i.items
    .map(
      (r) =>
        `<tr><td>${esc(r.name)}</td><td>${esc(r.unit)}</td><td class="right">${r.qty}</td><td class="right">${money(r.price)}</td><td class="right strong">${money(r.amount)}</td></tr>`,
    )
    .join("");
  ctx.modal(
    `<div class="modal-head"><div><h2>${esc(i.id)}</h2><div class="muted">${esc(displayName(i.customer_name))} · ${dateText(i.invoice_date)}</div></div>${button(icon("close"), "close", "icon-only white", "data-close")}</div>
    <div class="grid3 mb16"><div class="summary-box">Tổng tiền<div class="strong">${money(i.total)}</div></div><div class="summary-box">Đã thu<div class="strong green">${money(i.paid)}</div></div><div class="summary-box">Còn nợ<div class="strong red">${money(i.balance)}</div></div></div><div class="table-wrap"><table><thead><tr><th>Mặt hàng</th><th>ĐVT</th><th class="right">SL</th><th class="right">Đơn giá</th><th class="right">Thành tiền</th></tr></thead><tbody>${items}</tbody></table></div><div class="form-actions">${button("Xóa", "delete", "danger")}${button("Sửa", "edit")}${button("Xuất PDF", "pdf")}${button("Thu tiền", "collect", "primary")}</div>`,
    (box) =>
      box.addEventListener("click", async (e) => {
        const action = e.target.closest("[data-action]")?.dataset.action;
        try {
          if (action === "edit") {
            ctx.closeModal();
            ctx.navigate("invoiceForm", { id });
          }
          if (action === "collect") {
            ctx.closeModal();
            ctx.navigate("payments", { invoiceId: id, open: true });
          }
          if (action === "pdf")
            ctx.toast(
              `Đã xuất ${await api["exports.pdf"]({ kind: "invoice", filter: { id } })}`,
            );
          if (action === "delete") {
            const outcome = await ctx.perform(e.target.closest("[data-action]"), {
              title: "Xóa hóa đơn?", message: `Bạn có chắc muốn xóa hóa đơn ${id} không?`,
              label: "Xóa hóa đơn", danger: true, loading: "Đang xóa…",
              success: "Đã xóa hóa đơn.",
            }, () => api["invoices.remove"](id));
            if (outcome.ok) { ctx.closeModal(true); ctx.refresh(); }
          }
        } catch (x) {
          ctx.toast(x.message, true);
        }
      }),
  );
}
export function bind(root, ctx, args = {}) {
  bindList(root, ctx);
  root.addEventListener("click", async (e) => {
    const target = e.target.closest("[data-detail],[data-detail-row]");
    if (target && !e.target.closest("button,input")) {
      e.preventDefault();
      try {
        await detail(ctx, target.dataset.detail || target.dataset.detailRow);
      } catch (x) {
        ctx.toast(x.message, true);
      }
      return;
    }
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    try {
      if (action === "new") ctx.navigate("invoiceForm");
      if (action.startsWith("detail:")) await detail(ctx, action.slice(7));
      if (action.startsWith("collect:"))
        ctx.navigate("payments", { invoiceId: action.slice(8), open: true });
      if (action === "pdf")
        ctx.toast(
          `Đã xuất ${await api["exports.pdf"]({ kind: "invoices", filter: exportFilter() })}`,
        );
      if (action === "excel")
        ctx.toast(
          `Đã xuất ${await api["exports.excel"]({ kind: "invoices", filter: exportFilter() })}`,
        );
      if (action === "csv")
        ctx.toast(
          `Đã xuất ${await api["exports.csv"]({ kind: "invoices", filter: exportFilter() })}`,
        );
    } catch (x) {
      ctx.toast(x.message, true);
    }
  });
  if (args.openId)
    detail(ctx, args.openId).catch((error) => ctx.toast(error.message, true));
}
