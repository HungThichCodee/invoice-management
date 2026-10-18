import {
  api,
  esc,
  money,
  icon,
  button,
  field,
  select,
  textarea,
  formData,
  checkNumbers,
  today,
} from "../ui.js";
import { renderList, bindList, exportFilter } from "./paymentList.js";
import { paymentDialog } from "./paymentDialog.js";
export async function render(ctx, args = {}) {
  if (args.reset) ctx.state.args = {};
  return renderList(args);
}
async function editDialog(ctx, id) {
  const row = (await api["payments.list"]({})).find((x) => x.id === id);
  if (!row) throw Error("Không tìm thấy phiếu thu.");
  ctx.modal(
    `<div class="modal-head"><h2>Sửa phiếu thu ${esc(id)}</h2>${button(icon("close"), "close", "icon-only white", "data-close")}</div>
    <form class="stack"><div class="summary-box">Hóa đơn: <strong>${esc(row.invoice_id)}</strong></div>${field("Số tiền (₫)", "amount", row.amount, "number", 'step="1" required')}
    <div class="fields">${field("Ngày thu", "date", row.pay_date, "date", "required")}${select(
      "Phương thức",
      "method",
      [
        ["cash", "Tiền mặt"],
        ["bank", "Chuyển khoản"],
        ["other", "Khác"],
      ],
      row.method,
    )}</div>
    ${textarea("Ghi chú", "note", row.note)}<div class="form-actions">${button("Hủy", "cancel", "white", "data-close")}<button type="submit" class="button primary">Lưu thay đổi</button></div></form>`,
    (box) => {
      box.querySelector("form").addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
          checkNumbers(e.target);
          const outcome = await ctx.perform(e.submitter, {
            title: "Lưu sửa phiếu thu?", message: "Cập nhật phiếu thu này?",
            label: "Lưu thay đổi", loading: "Đang lưu…",
            success: "Cập nhật phiếu thu thành công.",
          }, () => api["payments.update"]({
            ...formData(e.target),
            id,
            amount: Number(e.target.querySelector("[name=amount]").value),
          }));
          if (outcome.ok) { ctx.closeModal(true); ctx.refresh(); }
        } catch (x) {
          ctx.toast(x.message, true);
        }
      });
    },
  );
}
export function bind(root, ctx, args) {
  bindList(root, ctx, args);
  root.addEventListener("click", async (e) => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    try {
      if (action === "create") await paymentDialog(ctx, args.invoiceId);
      if (action.startsWith("edit:")) await editDialog(ctx, action.slice(5));
      if (action.startsWith("delete:")) {
        const outcome = await ctx.perform(e.target.closest("[data-action]"), {
          title: "Xóa phiếu thu?", message: "Bạn có chắc muốn xóa phiếu thu này không?",
          label: "Xóa phiếu thu", danger: true, loading: "Đang xóa…",
          success: "Đã xóa phiếu thu.",
        }, () => api["payments.remove"](action.slice(7)));
        if (outcome.ok) ctx.refresh();
      }
      if (action === "clearPeriod") ctx.navigate("payments", { all: true });
      if (action === "excel")
        ctx.toast(
          `Đã xuất ${await api["exports.excel"]({ kind: "payments", filter: exportFilter() })}`,
        );
      if (action === "pdf")
        ctx.toast(
          `Đã xuất ${await api["exports.pdf"]({ kind: "payments", filter: exportFilter() })}`,
        );
      if (action.startsWith("print:"))
        ctx.toast(
          `Đã xuất ${await api["exports.pdf"]({ kind: "receipt", filter: { id: action.slice(6) } })}`,
        );
    } catch (x) {
      ctx.toast(x.message, true);
    }
  });
  if (args.open) {
    ctx.state.args = { ...args, open: false };
    paymentDialog(ctx, args.invoiceId).catch((x) => ctx.toast(x.message, true));
  }
}
