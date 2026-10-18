import { api, button, empty, icon } from "../ui.js";
import { activityRow } from "../widgets/activity.js";
let page = 1;
export async function render() {
  const data = await api["reports.activity"](page);
  page = data.page;
  return `<div class="page-head"><div><h1>Hoạt động</h1><p class="subtitle">Các thay đổi hóa đơn, phiếu thu và khách hàng trên máy này</p></div>${button(`${icon("arrow_back")} Tổng quan`, "dashboard", "white")}</div>
    <section class="card activity-list">${data.rows.map(activityRow).join("") || empty("Chưa có hoạt động")}
    <div class="pagination">${button("Trước", "previous", "compact white", page <= 1 ? "disabled" : "")}<span>Trang ${page}/${data.pages}</span>${button("Sau", "next", "compact white", page >= data.pages ? "disabled" : "")}</div></section>`;
}
export function bind(root, ctx) {
  root.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "dashboard") ctx.navigate("dashboard");
    if (action === "previous" && page > 1) {
      page--;
      ctx.refresh();
    }
    if (action === "next") {
      page++;
      ctx.refresh();
    }
  });
}
