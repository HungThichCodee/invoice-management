import { api, esc, icon, button, field, textarea, formData } from "../ui.js";
import { renderList, bindList, exportFilter } from "./customerList.js";
export async function render() {
  return renderList();
}
export async function customerDialog(ctx, id = null) {
  const c = id ? await api["customers.get"](id) : {};
  ctx.modal(
    `<div class="modal-head"><h2>${id ? "Sửa" : "Thêm"} khách hàng</h2>${button(icon("close"), "close", "icon-only white", "data-close")}</div><form id="customerForm" class="stack">${field("Tên khách hàng", "name", c.name || "", "text", "required")}${field("Điện thoại", "phone", c.phone || "")}${field("Địa chỉ", "address", c.address || "")}${field("Người liên hệ", "contact", c.contact || "")}${textarea("Ghi chú", "note", c.note || "")}<div class="form-actions">${id ? button("Xóa khách hàng", "delete", "danger") : ""}<button class="button primary" type="submit">Lưu khách hàng</button></div></form>`,
    (box) => {
      box.querySelector("form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const outcome = await ctx.perform(e.submitter, {
          title: id ? "Lưu sửa khách hàng?" : "Tạo khách hàng?",
          message: id ? "Cập nhật hồ sơ khách hàng này?" : "Lưu khách hàng mới vào danh sách?",
          label: id ? "Lưu thay đổi" : "Tạo khách hàng",
          loading: "Đang lưu…",
          success: id ? "Cập nhật khách hàng thành công." : "Tạo khách hàng thành công.",
        }, () => api[id ? "customers.update" : "customers.create"]({
            ...formData(e.target),
            id,
          }));
        if (outcome.ok) {
          ctx.closeModal(true);
          ctx.refresh();
        }
      });
      box
        .querySelector("[data-action=delete]")
        ?.addEventListener("click", async (event) => {
          const outcome = await ctx.perform(event.currentTarget, {
            title: "Xóa khách hàng?", message: "Bạn có chắc muốn xóa khách hàng này không?",
            label: "Xóa khách hàng", danger: true, loading: "Đang xóa…",
            success: "Đã xóa khách hàng.",
          }, () => api["customers.remove"](id));
          if (outcome.ok) { ctx.closeModal(true); ctx.refresh(); }
        });
    },
  );
}
export function bind(root, ctx) {
  bindList(root, ctx);
  root.addEventListener("click", async (e) => {
    const profile = e.target.closest("[data-profile]");
    if (profile) {
      e.preventDefault();
      ctx.navigate("customerProfile", { id: Number(profile.dataset.profile) });
      return;
    }
    const row = e.target.closest("[data-customer-row]");
    if (row && !e.target.closest("button,a")) {
      ctx.navigate("customerProfile", { id: Number(row.dataset.customerRow) });
      return;
    }
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    try {
      if (action === "add") customerDialog(ctx);
      if (action === "excel")
        ctx.toast(
          `Đã xuất ${await api["exports.excel"]({ kind: "customers", filter: exportFilter() })}`,
        );
      if (action.startsWith("profile:"))
        ctx.navigate("customerProfile", { id: Number(action.slice(8)) });
      if (action.startsWith("edit:"))
        customerDialog(ctx, Number(action.slice(5)));
    } catch (x) {
      ctx.toast(x.message, true);
    }
  });
}
