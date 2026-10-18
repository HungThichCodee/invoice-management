import { api, esc, icon, button, field, textarea, formData } from "../ui.js";
export async function render() {
  const s = await api["settings.get"]();
  const format = (prefix, width, counter) => `${prefix}-${String(Number(counter) + 1).padStart(Number(width), "0")}`;
  const widths = (name, current) => `<select name="${name}" aria-label="Độ dài số">${[6, 5, 4].map((n) => `<option value="${n}" ${Number(current || 6) === n ? "selected" : ""}>${n} số (${String(1).padStart(n, "0")})</option>`).join("")}</select>`;
  return `<div class="page-head"><div><h1>Cài đặt hệ thống</h1><p class="subtitle">Thông tin đơn vị bán hàng, số chứng từ và nơi lưu dữ liệu</p></div>${button(`${icon("save")} Lưu thay đổi cài đặt`, "save", "primary")}</div>
    <div class="settings-layout"><aside class="settings-side"><div class="card settings-menu"><button type="button" data-scroll="sellerCard" class="active">${icon("storefront")} Đơn vị bán hàng</button><button type="button" data-scroll="documentCard">${icon("receipt_long")} Mẫu mã & số hóa đơn</button><button type="button" data-scroll="storageCard">${icon("folder_open")} Thư mục & dữ liệu</button><button type="button" data-scroll="appearanceCard">${icon("palette")} Giao diện & hiển thị</button></div><div class="card settings-environment"><strong>THÔNG SỐ MÔI TRƯỜNG</strong><div class="stat-row"><span>Database</span><b>SQLite cục bộ</b></div><div class="stat-row"><span>Mạng</span><b class="green">Không yêu cầu</b></div></div></aside>
    <form id="settingsForm" class="stack settings-cards"><section class="card" id="sellerCard"><h2>Thông tin đơn vị bán hàng</h2><p class="subtitle">Hiển thị trên hóa đơn và tài liệu xuất PDF</p>
      <div class="settings-logo"><div class="settings-logo-image">${s.logoData ? `<img src="${esc(s.logoData)}" alt="Logo đơn vị">` : icon("forklift")}</div><div><strong>Logo thương hiệu của đơn vị</strong><p class="small muted">Ảnh PNG/JPG dưới 5 MB, được lưu trên máy này.</p><div class="flex gap">${button(`${icon("upload")} Thay đổi logo`, "logo", "compact white")}${s.logoData ? button("Xóa", "removeLogo", "compact danger") : ""}</div></div></div>
      <div class="fields mt16">${field("Tên đơn vị", "sellerName", s.sellerName || "Xe Nâng Minh Phát")}${field("Mã số thuế", "sellerTaxId", s.sellerTaxId || "")}${field("Điện thoại", "sellerPhone", s.sellerPhone || "")}${field("Email", "sellerEmail", s.sellerEmail || "", "email")}${field("Địa chỉ", "sellerAddress", s.sellerAddress || "")}${field("Ngân hàng / tài khoản", "sellerBank", s.sellerBank || "")}</div>${textarea("Ghi chú chân trang in trên hóa đơn", "sellerNote", s.sellerNote || "")}</section>
    <section class="card" id="documentCard"><h2>Quy tắc mã chứng từ</h2><p class="subtitle">Cấp mã liên tục, không trùng lặp trong cơ sở dữ liệu</p><div class="settings-document-grid">
      <div class="settings-document"><h3>${icon("receipt_long")} Hóa đơn kinh doanh / Thuê xe</h3><div class="fields three">${field("Tiền tố", "invoicePrefix", `${s.invoicePrefix || "HD"}-`, "text", 'maxlength="9"') }<div class="field"><label>Độ dài số</label>${widths("invoiceNumberLength", s.invoiceNumberLength)}</div>${field("Bộ đếm", "invoiceCounter", s.invoiceCounter, "number", 'step="1" max="999999999"')}</div><div class="settings-next"><span>Mã số tạo tiếp theo:</span><strong id="invoiceNext">${esc(format(s.invoicePrefix || "HD", s.invoiceNumberLength || 6, s.invoiceCounter))}</strong></div></div>
      <div class="settings-document"><h3>${icon("payments")} Phiếu thu tiền</h3><div class="fields three">${field("Tiền tố", "paymentPrefix", `${s.paymentPrefix || "PT"}-`, "text", 'maxlength="9"') }<div class="field"><label>Độ dài số</label>${widths("paymentNumberLength", s.paymentNumberLength)}</div>${field("Bộ đếm", "paymentCounter", s.paymentCounter, "number", 'step="1" max="999999999"')}</div><div class="settings-next"><span>Mã số tạo tiếp theo:</span><strong id="paymentNext">${esc(format(s.paymentPrefix || "PT", s.paymentNumberLength || 6, s.paymentCounter))}</strong></div></div></div></section>
    <section class="card" id="storageCard"><h2>Thư mục lưu trữ & Xuất file</h2><div class="stat-row"><span>Thư mục dữ liệu<br><small class="muted">${esc(s.dataFolder)}</small></span>${button("Thay đổi…", "dataFolder")}</div><div class="stat-row"><span>Thư mục xuất file<br><small class="muted">${esc(s.exportFolder || "Mặc định dưới thư mục dữ liệu")}</small></span>${button("Thay đổi…", "exportFolder")}</div></section>
    <section class="card" id="appearanceCard"><h2>Giao diện & trải nghiệm</h2><label class="flex gap"><input type="checkbox" name="darkMode" ${s.darkMode === "true" ? "checked" : ""}> Giao diện tối</label><div class="settings-font"><div><strong>Cỡ chữ văn bản bảng biểu & hóa đơn</strong><p class="small muted">Phù hợp màn hình từ 14 đến 24 inch</p></div><select name="fontSize" aria-label="Cỡ chữ">${[[13, "13px - Nhỏ gọn"], [14, "14px - Tiêu chuẩn"], [15, "15px - Lớn dễ nhìn"]].map(([n, label]) => `<option value="${n}" ${Number(s.fontSize || 14) === n ? "selected" : ""}>${label}</option>`).join("")}</select></div><p class="help mt16">Ứng dụng chạy hoàn toàn offline; không gửi dữ liệu ra ngoài.</p></section></form></div>`;
}
export function bind(root, ctx) {
  const form = root.querySelector("#settingsForm");
  ctx.trackPage(form);
  const syncCode = () => {
    for (const kind of ["invoice", "payment"]) {
      const form = root.querySelector("#settingsForm");
      const prefix = form.elements[`${kind}Prefix`].value.trim().replace(/-$/, "").toUpperCase();
      const width = Number(form.elements[`${kind}NumberLength`].value);
      const counter = Number(form.elements[`${kind}Counter`].value);
      root.querySelector(`#${kind}Next`).textContent = `${prefix}-${String(Math.max(0, counter) + 1).padStart(width, "0")}`;
    }
  };
  root.querySelector("#documentCard").addEventListener("input", syncCode);
  root.querySelector("#documentCard").addEventListener("change", syncCode);
  const save = async () => {
    const values = formData(form);
    values.darkMode = String(root.querySelector("[name=darkMode]").checked);
    const outcome = await ctx.perform(root.querySelector('[data-action="save"]'), {
      title: "Lưu cài đặt?", message: "Áp dụng các thay đổi cài đặt?",
      label: "Lưu cài đặt", loading: "Đang lưu…", success: "Lưu cài đặt thành công.",
    }, () => api["settings.update"](values));
    if (!outcome.ok) return;
    document.body.classList.toggle("dark", values.darkMode === "true");
    document.body.dataset.fontSize = values.fontSize;
    ctx.setBranding({ ...ctx.state.brand, sellerName: outcome.result.sellerName });
    ctx.trackPage(form);
  };
  root.addEventListener("click", async (e) => {
    const scroll = e.target.closest("[data-scroll]");
    if (scroll) { root.querySelector(`#${scroll.dataset.scroll}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    try {
      if (action === "save") await save();
      if (action === "dataFolder" || action === "exportFolder") {
        const outcome = await ctx.perform(e.target.closest("[data-action]"), {
          title: "Đổi thư mục lưu?",
          message: action === "dataFolder" ? "Sao chép dữ liệu sang thư mục mới? Bản cũ vẫn được giữ lại." : "Dùng thư mục mới cho các file xuất?",
          label: "Chọn thư mục", loading: "Đang xử lý…",
        }, () => api["settings.chooseFolder"](action === "dataFolder" ? "data" : "export"));
        if (outcome.ok && outcome.result) {
          const index = action === "dataFolder" ? 0 : 1;
          root.querySelectorAll("#storageCard .stat-row small")[index].textContent = outcome.result;
          if (action === "dataFolder") await ctx.refreshBranding();
          ctx.toast("Cập nhật thư mục thành công.");
        }
      }
      if (action === "logo") {
        const outcome = await ctx.perform(e.target.closest("[data-action]"), {
          title: "Đổi logo?", message: "Chọn logo mới và lưu vào ứng dụng?",
          label: "Chọn logo", loading: "Đang lưu…",
        }, () => api["settings.chooseLogo"]());
        if (outcome.ok && outcome.result) {
          const fresh = await api["settings.get"]();
          root.querySelector(".settings-logo-image").innerHTML = `<img src="${esc(fresh.logoData)}" alt="Logo đơn vị">`;
          ctx.setBranding(fresh);
          if (!root.querySelector('[data-action="removeLogo"]'))
            root.querySelector('[data-action="logo"]').insertAdjacentHTML("afterend", button("Xóa", "removeLogo", "compact danger"));
          ctx.toast("Cập nhật logo thành công.");
        }
      }
      if (action === "removeLogo") {
        const outcome = await ctx.perform(e.target.closest("[data-action]"), {
          title: "Xóa logo?", message: "Bạn có chắc muốn xóa logo hiện tại không?",
          label: "Xóa logo", danger: true, loading: "Đang xóa…",
          success: "Đã xóa logo.",
        }, () => api["settings.removeLogo"]());
        if (outcome.ok) {
          root.querySelector(".settings-logo-image").innerHTML = icon("forklift");
          ctx.setBranding({ ...ctx.state.brand, logoData: null });
          root.querySelector('[data-action="removeLogo"]')?.remove();
        }
      }
    } catch (x) {
      ctx.toast(x.message, true);
    }
  });
}
