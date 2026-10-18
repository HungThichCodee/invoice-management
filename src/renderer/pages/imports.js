import {
  api,
  esc,
  dateTimeText,
  icon,
  button,
  empty,
  field,
  formData,
  checkNumbers,
} from "../ui.js";
import { issueStats, statusCards, issueRows } from "../widgets/importPreview.js";
let selected = null,
  preview = null,
  strategy = "skip";
export async function onLeave(ctx) {
  if ((selected || preview) && !(await ctx.confirm({
    title: "Bỏ lần nhập?",
    message: "Bạn có thay đổi chưa lưu, thoát sẽ mất dữ liệu. Bạn có chắc không?",
    label: "Thoát và bỏ thay đổi", danger: true,
  }))) return false;
  const hadSession = !!(selected || preview);
  selected = null;
  preview = null;
  await api["imports.cancel"]();
  if (hadSession) ctx.toast("Đã hủy nhập liệu.");
  return true;
}
export async function render() {
  const [history, session] = await Promise.all([api["imports.history"](), api["imports.session"]()]);
  selected = session;
  if (!session) preview = null;
  else if (preview) preview = await api["imports.preview"]();
  const stats = issueStats(preview);
  const logs = history
    .slice(0, 5)
    .map(
      (h) =>
        `<div class="activity">${icon(h.undone_at ? "history" : "check_circle")}<div><strong>${esc(h.source_name)}</strong><div class="small muted">${dateTimeText(h.created_at)} · ${h.undone_at ? "Đã hoàn tác" : "Thành công"}</div></div></div>`,
    )
    .join("");
  return `<div class="page-head"><div><h1>Nhập / Xuất dữ liệu</h1><p class="subtitle">Nhập khách hàng, hóa đơn và phiếu thu từ Excel/CSV; xuất sổ dữ liệu offline</p></div></div>
    <div class="grid3"><section class="card col2"><div class="card-head"><div><h2>Quy trình nhập dữ liệu từ file</h2><p class="subtitle">Chọn file → kiểm tra lỗi → xử lý trùng → xác nhận lưu</p></div>${button("Quy tắc nhập file", "rules", "compact")}</div>
    <div class="stepper import-stepper"><span class="step ${selected ? "active" : ""}">1. Chọn file</span><span class="step ${preview ? "active" : ""}">2. Ghép cột</span><span class="step ${preview ? "active" : ""}">3. Kiểm tra lỗi</span><span class="step ${preview && !stats.errors ? "active" : ""}">4. Xử lý trùng</span><span class="step">5. Lưu dữ liệu</span></div>
    <div class="summary-box between import-file"><div>${icon("upload_file")} <strong>${selected ? esc(selected.name) : "Chưa chọn file"}</strong><div class="small muted">${selected ? `${selected.sheets.length} sheet dữ liệu · ` : ""}Hỗ trợ .xlsx, .csv UTF-8</div></div>${button(selected ? "Chọn file khác" : "Chọn file", "choose", "primary")}</div>
    ${selected ? `<div class="mt16">${button(`${icon("visibility")} Xem trước / kiểm tra lỗi`, "preview")}</div>` : ""}
    ${
      preview
        ? `${statusCards(preview)}<div class="mt16"><h3>${stats.errors ? `Chi tiết ${stats.errorRows} dòng cần chỉnh sửa` : stats.warnings ? "Cảnh báo có thể bổ sung; file đã có thể nhập" : "File hợp lệ, có thể nhập"}</h3><div class="table-wrap import-errors"><table><thead><tr><th>Vị trí</th><th>Trường</th><th>Giá trị trong file</th><th>Mô tả lỗi</th><th>Thao tác</th></tr></thead><tbody>${issueRows(preview) || `<tr><td colspan="5">${empty("Không có lỗi")}</td></tr>`}</tbody></table></div></div>
      <div class="filterbar mt16 import-actions">${stats.errors ? button(`Bỏ qua ${stats.errorRows} dòng lỗi`, "skipErrors", "warning") : ""}<label>Cách xử lý dữ liệu trùng:</label><select id="strategy"><option value="skip">Bỏ qua bản trùng</option><option value="update">Cập nhật bản trùng</option><option value="new">Tạo bản mới</option></select>${button("Tiếp tục & lưu dữ liệu →", "commit", "primary", stats.errors ? "disabled" : "")}</div>`
        : ""
    }</section>
    <aside class="stack"><section class="card"><h2>Xuất dữ liệu hệ thống</h2><p class="subtitle">Tạo báo cáo và bảng kê để lưu trữ hoặc đối chiếu thuế</p><div class="stack">${button(`${icon("table_view")} Xuất Excel toàn bộ (6 sheet)`, "excel", "w100")}${button(`${icon("description")} Xuất CSV hóa đơn`, "csv", "w100")}${button(`${icon("download")} Tải file mẫu (.xlsx)`, "template", "w100")}</div></section><section class="card"><h2>Nhật ký nhập gần đây</h2>${logs || empty("Chưa có lần nhập")}${button("Hoàn tác lần nhập gần nhất", "undo", "danger w100")}</section></aside></div>`;
}
function editRow(ctx, sheet, line) {
  const group = Object.entries(preview.groups).find(([, rows]) =>
    rows.some((r) => r._sheet === sheet && r._line === line),
  );
  const row = group?.[1].find((r) => r._sheet === sheet && r._line === line);
  if (!row) throw Error("Không tìm thấy dòng cần sửa.");
  const map = {
    invoices: [
      "code",
      "date",
      "due",
      "customer",
      "phone",
      "total",
      "taxRate",
      "discount",
    ],
    details: ["invoice", "name", "unit", "qty", "price", "capacity", "hours"],
    payments: ["invoice", "date", "amount", "method"],
    customers: ["customer", "phone", "address"],
    vehicles: ["name", "model", "serial", "capacity", "hours", "price"],
    parts: ["name", "model", "serial", "price"],
  };
  const number = new Set([
    "total",
    "taxRate",
    "discount",
    "qty",
    "price",
    "capacity",
    "hours",
    "amount",
  ]);
  const labels = {
    code: "Mã hóa đơn",
    invoice: "Mã hóa đơn liên kết",
    date: "Ngày",
    due: "Hạn trả",
    customer: "Khách hàng",
    phone: "Điện thoại",
    total: "Tổng tiền",
    taxRate: "Thuế %",
    discount: "Chiết khấu",
    name: "Tên",
    unit: "ĐVT",
    qty: "Số lượng",
    price: "Đơn giá",
    capacity: "Trọng tải kg",
    hours: "Số giờ",
    amount: "Số tiền",
    method: "Phương thức",
    address: "Địa chỉ",
    model: "Model",
    serial: "Serial",
  };
  const fields = (map[group[0]] || [])
    .map((k) =>
      field(
        labels[k] || k,
        k,
        row[k] || "",
        number.has(k)
          ? "number"
          : k === "date" || k === "due"
            ? "date"
            : "text",
      ),
    )
    .join("");
  ctx.modal(
    `<div class="modal-head"><h2>Sửa dòng ${line} · ${esc(sheet)}</h2>${button(icon("close"), "close", "icon-only white", "data-close")}</div><form class="fields">${fields}<div class="form-actions full"><button class="button primary" type="submit">Kiểm tra lại</button></div></form>`,
    (box) => {
      box.querySelector("form").addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
          checkNumbers(e.target);
          const outcome = await ctx.perform(e.submitter, {
            title: "Sửa dòng nhập liệu?", message: "Kiểm tra lại dòng vừa sửa?",
            label: "Lưu sửa dòng", loading: "Đang kiểm tra…",
            success: "Cập nhật dòng thành công.",
          }, () => api["imports.updateRow"]({
            sheet,
            line,
            values: formData(e.target),
          }));
          if (outcome.ok) { preview = outcome.result; ctx.closeModal(true); ctx.refresh(); }
        } catch (x) {
          ctx.toast(x.message, true);
        }
      });
    },
  );
}
export function bind(root, ctx) {
  const select = root.querySelector("#strategy");
  if (select) {
    select.value = strategy;
    select.addEventListener("change", (e) => (strategy = e.target.value));
  }
  root.addEventListener("click", async (e) => {
    const correction = e.target.closest("[data-action^='edit:']");
    if (correction) {
      const [, sheet, line] = correction.dataset.action.split(":");
      editRow(ctx, sheet, Number(line));
      return;
    }
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    try {
      if (action === "choose") {
        const next = await api["imports.choose"]();
        if (!next) return;
        selected = next;
        preview = null;
        ctx.refresh();
      }
      if (action === "preview") {
        preview = await api["imports.preview"]();
        ctx.refresh();
      }
      if (action === "skipErrors") {
        const outcome = await ctx.perform(e.target.closest("[data-action]"), {
          title: "Bỏ dòng lỗi?", message: "Xóa các dòng lỗi khỏi bản xem trước?",
          label: "Bỏ dòng lỗi", danger: true, loading: "Đang xử lý…",
        }, () => api["imports.skipErrors"]());
        if (outcome.ok) {
          preview = outcome.result;
          ctx.toast(`Đã bỏ qua ${preview.removed} dòng lỗi.`);
          ctx.refresh();
        }
      }
      if (action === "commit") {
        const outcome = await ctx.perform(e.target.closest("[data-action]"), {
          title: "Nhập dữ liệu?", message: "Lưu toàn bộ dữ liệu đã xem trước vào ứng dụng?",
          label: "Nhập dữ liệu", loading: "Đang nhập…",
        }, () => api["imports.commit"](strategy));
        if (outcome.ok) {
          selected = null; preview = null;
          ctx.toast(`Đã nhập ${outcome.result.counts.invoices} hóa đơn.`);
          ctx.refresh();
        }
      }
      if (action === "undo") {
        const outcome = await ctx.perform(e.target.closest("[data-action]"), {
          title: "Hoàn tác nhập liệu?", message: "Xóa dữ liệu của lần nhập gần nhất?",
          label: "Hoàn tác", danger: true, loading: "Đang hoàn tác…",
          success: "Đã hoàn tác lần nhập.",
        }, () => api["imports.undo"]());
        if (outcome.ok) ctx.refresh();
      }
      if (action === "excel" || action === "template")
        ctx.toast(
          `Đã tạo ${await api["exports.excel"](action === "template" ? { kind: "template" } : {})}`,
        );
      if (action === "csv")
        ctx.toast(
          `Đã tạo ${await api["exports.csv"]({ kind: "invoices", filter: {} })}`,
        );
      if (action === "rules")
        ctx.modal(
          `<div class="modal-head"><h2>Quy tắc nhập file</h2>${button(icon("close"), "close", "icon-only white", "data-close")}</div><p>File Excel có thể gồm các sheet Hóa đơn, Chi tiết, Thu tiền, Khách hàng, Xe, Phụ tùng. Dòng đầu là tiêu đề cột. Mỗi phiếu thu cần mã hóa đơn tương ứng. Số lượng và số tiền phải không âm; số lượng mặt hàng phải lớn hơn 0.</p><p>File CSV đơn lẻ được hiểu là danh sách hóa đơn. Hãy xuất file Excel mẫu để dùng đúng tên cột.</p>`,
        );
    } catch (x) {
      ctx.toast(x.message, true);
    }
  });
}
