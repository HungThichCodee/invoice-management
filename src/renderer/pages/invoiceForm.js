import {
  api,
  esc,
  money,
  dateText,
  icon,
  button,
  field,
  select,
  textarea,
  formData,
  checkNumbers,
  today,
} from "../ui.js";
const plusDays = (day, n) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const defaultItem = {
  kind: "service",
  name: "",
  unit: "lần",
  qty: 1,
  price: 0,
  model: "",
  serial: "",
  capacity: 0,
  hours: 0,
};
function customerOverview(c) {
  if (!c) return '<span class="muted">Chọn khách hàng để xem hồ sơ và công nợ hiện tại.</span>';
  return `<div class="client-overview"><div><span>Người liên hệ</span><strong>${esc(c.contact || "Chưa cập nhật")}</strong></div><div><span>Điện thoại liên lạc</span><strong>${esc(c.phone || "Chưa cập nhật")}</strong></div><div><span>Địa chỉ</span><strong>${esc(c.address || "Chưa cập nhật")}</strong></div></div>
    <div class="client-debt ${c.balance ? "has-debt" : ""}">${icon(c.balance ? "warning" : "check_circle")}<span>${c.balance ? `Khách hàng đang nợ <strong>${money(c.balance)}</strong>` : "Khách hàng chưa có công nợ"}</span><button type="button" data-action="customerDebt">Xem hồ sơ →</button></div>`;
}
function itemRow(item = defaultItem) {
  return `<div class="line-item"><div class="field"><label>Mặt hàng / dịch vụ</label><input name="itemName" value="${esc(item.name)}" required placeholder="Tên dịch vụ hoặc phụ tùng"></div>
    ${select(
      "Loại",
      "itemKind",
      [
        ["service", "Dịch vụ"],
        ["vehicle", "Xe nâng"],
        ["part", "Phụ tùng"],
      ],
      item.kind,
    )}
    ${field("ĐVT", "itemUnit", item.unit)}${field("Số lượng", "itemQty", item.qty, "number", 'step="0.001" required')}${field("Đơn giá (₫)", "itemPrice", item.price, "number", 'step="1" required')}
    ${button(icon("delete"), "removeItem", "danger compact delete")}
    <div class="fields full" style="grid-column:1/-1;margin-bottom:10px">${field("Model", "itemModel", item.model)}${field("Serial / biển số", "itemSerial", item.serial)}${field("Trọng tải (kg)", "itemCapacity", item.capacity, "number")}${field("Số giờ", "itemHours", item.hours, "number", 'step="0.001"')}</div></div>`;
}
export async function render(_ctx, args = {}) {
  const [clients, invoice, settings] = await Promise.all([
    api["customers.list"](""),
    args.id ? api["invoices.get"](args.id) : Promise.resolve(null),
    api["settings.get"](),
  ]);
  const date = invoice?.invoice_date || today(),
    due = invoice?.due_date || plusDays(date, 15);
  const customerOptions = [
    ["", "Chọn khách hàng"],
    ...clients.map((c) => [c.id, `${c.name} (${c.code})`]),
  ];
  const chosen = clients.find(c => c.id === Number(invoice?.customer_id || args.customerId));
  const nextCode = `${settings.invoicePrefix || "HD"}-${String(Number(settings.invoiceCounter || 0) + 1).padStart(Number(settings.invoiceNumberLength || 6), "0")}`;
  return `<div class="page-head"><div><h1>${invoice ? `Sửa hóa đơn ${esc(invoice.id)}` : "Tạo hóa đơn dịch vụ & phụ tùng"}</h1><p class="subtitle">Thông tin khách hàng, kỳ hạn và chi tiết mặt hàng</p></div><div class="page-actions">${button(`${icon("history")} Hóa đơn gần đây`, "recent")}${button("Danh sách hóa đơn", "back")}</div></div>
  <form id="invoiceForm" class="grid3"><div class="col2 stack"><section class="card form-section"><div class="between"><h2>1. Thông tin khách hàng</h2>${button(`${icon("person_add")} Thêm khách mới`, "addCustomer", "compact")}</div>${select("Khách hàng / Doanh nghiệp thuê", "customerId", customerOptions, invoice?.customer_id || args.customerId || "")}<div id="clientDebt" class="mt16">${customerOverview(chosen)}</div></section>
    <section class="card form-section"><h2>2. Thông tin hóa đơn</h2><div class="fields three">${field("Mã hóa đơn dự kiến", "invoiceId", invoice?.id || nextCode, "text", "readonly")}${field("Ngày lập hóa đơn", "date", date, "date", "required")}${field("Hạn thanh toán", "due", due, "date", "required")}</div><div class="flex gap mt16">Gợi ý hạn: ${button("+7 ngày", "days7", "compact")}${button("+15 ngày", "days15", "compact")}${button("+30 ngày", "days30", "compact")}</div><div class="mt16">${textarea("Ghi chú dịch vụ / điều khoản", "note", invoice?.note || "")}</div></section>
    <section class="card form-section"><div class="between"><h2>3. Chi tiết dịch vụ & phụ tùng</h2><span class="pill" id="rowCount"></span></div><div id="items">${(invoice?.items?.length ? invoice.items : [defaultItem]).map(itemRow).join("")}</div>${button(`${icon("add_circle")} Thêm dòng mặt hàng`, "addItem")}${button(`${icon("content_copy")} Sao chép mặt hàng từ hóa đơn gần nhất`, "copyItems")}</section></div>
    <aside><div class="card" style="position:sticky;top:85px"><h2>Tóm tắt hóa đơn</h2><p class="subtitle">Tổng tiền thanh toán được tính tự động</p><div class="stat-row"><span>Tiền hàng trước thuế</span><strong id="subtotal">0 ₫</strong></div><div class="fields mt16">${field("Thuế GTGT (%)", "taxRate", invoice?.tax_rate || 0, "number", 'max="100" step="1"')}${field("Chiết khấu (₫)", "discount", invoice?.discount || 0, "number", 'step="1"')}</div><div class="summary-box mt16"><div class="small blue strong">TỔNG TIỀN THANH TOÁN</div><div class="metric blue mono" id="total">0 ₫</div><div class="small muted">Hạn thanh toán: <span id="dueText">${dateText(due)}</span></div></div><div class="stack mt16">${button(`${icon("save")} Lưu hóa đơn`, "save", "primary w100")}${button("Lưu & Thu tiền ngay", "savePay", "w100")}${button("Lưu & Xuất PDF", "savePdf", "w100")}</div></div></aside></form>`;
}
function collect(form, id) {
  checkNumbers(form);
  const v = formData(form);
  const rows = [...form.querySelectorAll(".line-item")].map((row) => {
    const get = (name) => row.querySelector(`[name=${name}]`)?.value || "";
    return {
      name: get("itemName"),
      kind: get("itemKind"),
      unit: get("itemUnit"),
      qty: Number(get("itemQty")),
      price: Number(get("itemPrice")),
      model: get("itemModel"),
      serial: get("itemSerial"),
      capacity: Number(get("itemCapacity") || 0),
      hours: Number(get("itemHours") || 0),
    };
  });
  return {
    id,
    customerId: Number(v.customerId),
    date: v.date,
    due: v.due,
    note: v.note,
    taxRate: Number(v.taxRate || 0),
    discount: Number(v.discount || 0),
    items: rows,
  };
}
function updateTotals(form) {
  let subtotal = 0;
  for (const row of form.querySelectorAll(".line-item"))
    subtotal += Math.round(
      Number(row.querySelector("[name=itemQty]").value || 0) *
        Number(row.querySelector("[name=itemPrice]").value || 0),
    );
  const tax = Number(form.querySelector("[name=taxRate]").value || 0),
    discount = Number(form.querySelector("[name=discount]").value || 0);
  form.querySelector("#subtotal").textContent = money(subtotal);
  form.querySelector("#total").textContent = money(
    Math.max(0, subtotal + Math.round((subtotal * tax) / 100) - discount),
  );
  form.querySelector("#rowCount").textContent =
    `${form.querySelectorAll(".line-item").length} dòng`;
  form.querySelector("#dueText").textContent = dateText(
    form.querySelector("[name=due]").value,
  );
}
async function addCustomer(ctx, selectEl) {
  ctx.modal(
    `<div class="modal-head"><h2>Thêm khách hàng</h2>${button(icon("close"), "close", "icon-only white", "data-close")}</div><form id="newCustomer" class="stack">${field("Tên khách hàng", "name", "", "text", "required")}${field("Điện thoại", "phone")}${field("Địa chỉ", "address")}${field("Người liên hệ", "contact")}<div class="form-actions">${button("Hủy", "cancel", "white", "data-close")}<button class="button primary" type="submit">Lưu khách hàng</button></div></form>`,
    (box) =>
      box.querySelector("form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const outcome = await ctx.perform(e.submitter, { title: "Tạo khách hàng?",
          message: "Lưu khách hàng mới vào danh sách?", label: "Tạo khách hàng",
          loading: "Đang tạo…", success: "Tạo khách hàng thành công." },
        () => api["customers.create"](formData(e.target)));
        if (outcome.ok) {
          const c = outcome.result;
          selectEl.add(new Option(`${c.name} (${c.code})`, c.id));
          selectEl.value = c.id;
          selectEl.dispatchEvent(new Event("change", { bubbles: true }));
          ctx.closeModal(true);
        }
      }),
  );
}
export function bind(root, ctx, args = {}) {
  const form = root.querySelector("#invoiceForm");
  ctx.trackPage(form);
  updateTotals(form);
  form.addEventListener("input", () => updateTotals(form));
  form.addEventListener("change", async (e) => {
    if (e.target.name === "customerId") {
      const list = await api["customers.list"]("");
      const c = list.find((x) => x.id === Number(e.target.value));
      root.querySelector("#clientDebt").innerHTML = customerOverview(c);
    }
  });
  root.addEventListener("click", async (e) => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    try {
      if (action === "back") {
        const changed = ctx.hasChanges();
        if (await ctx.navigate("invoices") && !changed) ctx.toast("Đã hủy.");
      }
      if (action === "customerDebt") ctx.navigate("customerProfile", { id: Number(form.elements.customerId.value) });
      if (action === "addCustomer")
        addCustomer(ctx, form.querySelector("[name=customerId]"));
      if (action === "addItem") {
        root.querySelector("#items").insertAdjacentHTML("beforeend", itemRow());
        ctx.markPageDirty();
        updateTotals(form);
      }
      if (action === "removeItem") {
        if (form.querySelectorAll(".line-item").length > 1) {
          const row = e.target.closest(".line-item");
          if (await ctx.confirm({ title: "Xóa dòng hàng?",
            message: "Bạn có chắc muốn xóa dòng hàng này khỏi hóa đơn?",
            label: "Xóa dòng", danger: true })) {
            row.remove();
            ctx.markPageDirty();
            ctx.toast("Đã xóa dòng hàng.");
          }
        }
        updateTotals(form);
      }
      if (action.startsWith("days")) {
        const dueInput = form.querySelector("[name=due]");
        dueInput.value = plusDays(
          form.querySelector("[name=date]").value,
          Number(action.slice(4)),
        );
        dueInput.dispatchEvent(new Event("change", { bubbles: true }));
        updateTotals(form);
      }
      if (action === "recent" || action === "copyItems") {
        const list = await api["invoices.list"]({
          customerId: Number(form.querySelector("[name=customerId]").value),
        });
        if (!list.length) throw Error("Khách hàng chưa có hóa đơn trước đó.");
        if (action === "recent")
          ctx.navigate("invoiceForm", { id: list[0].id });
        else {
          const old = await api["invoices.get"](list[0].id);
          root.querySelector("#items").innerHTML = old.items
            .map(itemRow)
            .join("");
          ctx.markPageDirty();
          updateTotals(form);
        }
      }
      if (["save", "savePay", "savePdf"].includes(action)) {
        if (!form.reportValidity()) return;
        const input = collect(form, args.id);
        const outcome = await ctx.perform(e.target.closest("[data-action]"), {
          title: args.id ? "Lưu sửa hóa đơn?" : "Tạo hóa đơn?",
          message: args.id ? "Cập nhật nội dung hóa đơn này?" : "Lưu hóa đơn mới vào sổ?",
          label: args.id ? "Lưu thay đổi" : "Tạo hóa đơn",
          loading: "Đang lưu…",
          success: args.id ? "Cập nhật hóa đơn thành công." : "Tạo hóa đơn thành công.",
        }, () => api[args.id ? "invoices.update" : "invoices.create"](input));
        if (!outcome.ok) return;
        const result = outcome.result;
        ctx.resetPageDirty();
        if (action === "savePay")
          ctx.navigate("payments", { invoiceId: result.id, open: true });
        else if (action === "savePdf") {
          ctx.toast(
            `Đã xuất ${await api["exports.pdf"]({ kind: "invoice", filter: { id: result.id } })}`,
          );
          ctx.navigate("invoices");
        } else ctx.navigate("invoices");
      }
    } catch (x) {
      ctx.toast(x.message, true);
    }
  });
  root.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === "s") {
      e.preventDefault();
      root.querySelector("[data-action=save]").click();
    }
  });
}
