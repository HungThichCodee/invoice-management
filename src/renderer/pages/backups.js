import { api, esc, dateTimeText, icon, button, empty, today } from "../ui.js";
export async function render() {
  const [list, settings] = await Promise.all([
    api["backups.list"](),
    api["settings.get"](),
  ]);
  const history = list
    .map(
      (x) =>
        `<tr><td>${icon("database")} <strong title="${esc(x.name)}">${esc(x.name)}</strong></td><td>${dateTimeText(x.date)}</td><td>${(x.size / 1048576).toFixed(2)} MB</td><td><span class="pill paid">Đã lưu</span></td><td><div class="backup-row-actions">${button("Khôi phục", `restoreNamed:${x.name}`, "compact white")}${button("Tải ra USB", `copy:${x.name}`, "compact")}</div></td></tr>`,
    )
    .join("");
  const latest = list[0];
  const savedToday = latest && new Date(latest.date).toLocaleDateString("en-CA") === today();
  return `<div class="page-head backup-head"><div><h1>Sao lưu & Khôi phục dữ liệu</h1><p class="subtitle">Bảo vệ cơ sở dữ liệu hóa đơn, phiếu thu và khách hàng trên máy</p></div></div>
    <section class="backup-banner"><div class="backup-banner-icon">${icon("verified_user")}</div><div class="backup-banner-text"><h2>${savedToday ? "Dữ liệu đã được sao lưu hôm nay" : "Sẵn sàng sao lưu dữ liệu"}</h2><p>${latest ? `Bản gần nhất: ${dateTimeText(latest.date)} · ${(latest.size / 1048576).toFixed(2)} MB` : "Chưa có bản sao lưu nào trên máy này."}</p><div class="small">${list.length} bản sao đang lưu cục bộ</div></div><div class="backup-banner-actions">${button(`${icon("backup")} Sao lưu ngay bây giờ`, "backup", "primary")}${button("Khôi phục từ file…", "restore", "white")}</div></section>
    <div class="backup-layout"><section class="card backup-settings"><div class="flex gap"><div class="metric-icon blue">${icon("schedule")}</div><div><h2>Thiết lập sao lưu tự động</h2><p class="subtitle">Tạo bản sao khi mở ứng dụng</p></div></div>
      <label class="backup-toggle"><span><strong>Sao lưu hàng ngày</strong><small>Kiểm tra và tạo bản sao khi mở ứng dụng</small></span><input id="daily" name="dailyBackup" type="checkbox" ${settings.dailyBackup !== "false" ? "checked" : ""}></label>
      <div class="field"><label for="keep">Số bản lưu tối đa (0 = không giới hạn)</label><input type="number" min="0" step="1" id="keep" name="backupKeep" value="${esc(settings.backupKeep ?? 30)}"></div>
      <div class="backup-folder"><strong>Thư mục dữ liệu</strong><span title="${esc(settings.dataFolder)}">${esc(settings.dataFolder)}</span>${button(`${icon("folder_open")} Mở thư mục bản sao`, "folder", "compact white")}</div>${button("Lưu cấu hình sao lưu", "save", "primary w100")}</section>
      <section class="card backup-history"><div class="card-head"><div><h2>Lịch sử các bản sao lưu trên máy</h2><p class="subtitle">Khôi phục bản đã lưu hoặc chép ra thiết bị ngoài</p></div><div class="flex gap">${button("Dọn dẹp bản cũ", "prune", "compact white")}${button("Mở thư mục", "folder", "compact white")}</div></div><div class="table-wrap"><table><thead><tr><th>File sao lưu</th><th>Thời gian</th><th>Dung lượng</th><th>Trạng thái</th><th></th></tr></thead><tbody>${history || `<tr><td colspan="5">${empty("Chưa có bản sao lưu")}</td></tr>`}</tbody></table></div></section></div>
    <div class="backup-note">${icon("shield")} Trước khi khôi phục, hệ thống tự tạo một bản sao dữ liệu hiện tại để có thể quay lại nếu cần.</div>`;
}
export function bind(root, ctx) {
  const settingsCard = root.querySelector(".backup-settings");
  ctx.trackPage(settingsCard);
  root.addEventListener("click", async (e) => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    try {
      if (action === "backup") {
        const outcome = await ctx.perform(e.target.closest("[data-action]"), {
          title: "Tạo bản sao lưu?", message: "Lưu bản sao dữ liệu hiện tại?",
          label: "Sao lưu", loading: "Đang sao lưu…",
        }, () => api["backups.create"]());
        if (outcome.ok) { ctx.toast(`Đã sao lưu: ${outcome.result.name}`); ctx.refresh(); }
      }
      if (action === "restore") {
        const outcome = await ctx.perform(e.target.closest("[data-action]"), {
          loading: "Đang khôi phục…",
        }, () => api["backups.restore"]());
        if (outcome.ok && outcome.result) {
          await ctx.refreshBranding();
          ctx.toast("Đã khôi phục dữ liệu.");
          ctx.navigate("dashboard");
        }
      }
      if (action.startsWith("restoreNamed:")) {
        const outcome = await ctx.perform(e.target.closest("[data-action]"), {
          loading: "Đang khôi phục…",
        }, () => api["backups.restoreNamed"](action.slice(13)));
        if (outcome.ok && outcome.result) {
          await ctx.refreshBranding();
          ctx.toast("Đã khôi phục bản sao lưu.");
          ctx.navigate("dashboard");
        }
      }
      if (action === "folder") await api["files.openFolder"]("backup");
      if (action === "prune") {
        const outcome = await ctx.perform(e.target.closest("[data-action]"), {
          title: "Dọn bản sao cũ?", message: "Xóa các bản sao vượt quá số lượng lưu giữ?",
          label: "Dọn dẹp", danger: true, loading: "Đang dọn…",
        }, () => api["backups.prune"]());
        if (outcome.ok) { ctx.toast(`Đã dọn ${outcome.result} bản cũ.`); ctx.refresh(); }
      }
      if (action.startsWith("copy:")) {
        const target = await api["backups.copy"](action.slice(5));
        if (target) ctx.toast(`Đã chép ${target}`);
      }
      if (action === "save") {
        const keep = root.querySelector("#keep");
        if (Number(keep.value) < 0) throw Error("Số bản lưu phải không âm.");
        const outcome = await ctx.perform(e.target.closest("[data-action]"), {
          title: "Lưu cấu hình sao lưu?", message: "Áp dụng cấu hình sao lưu mới?",
          label: "Lưu cấu hình", loading: "Đang lưu…",
          success: "Lưu cấu hình thành công.",
        }, () => api["settings.update"]({
          dailyBackup: String(root.querySelector("#daily").checked),
          backupKeep: keep.value,
        }));
        if (outcome.ok) ctx.trackPage(settingsCard);
      }
    } catch (x) {
      ctx.toast(x.message, true);
    }
  });
}
