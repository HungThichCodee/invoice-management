export const api = window.invoiceApi;
export const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const money = (value) =>
  `${new Intl.NumberFormat("vi-VN").format(Number(value || 0))} ₫`;
export const displayName = (value) =>
  String(value ?? "")
    .trim()
    .replace(/^\S/u, (letter) => letter.toLocaleUpperCase("vi-VN"));
export const dateText = (value) =>
  value ? String(value).slice(2, 10).split("-").reverse().join("/") : "—";
export const dateTimeText = (value) => {
  if (!value) return "—";
  const d = new Date(value),
    two = (n) => String(n).padStart(2, "0");
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)} ${two(d.getHours())}:${two(d.getMinutes())}`;
};
export const today = () => new Date().toLocaleDateString("en-CA");
export const icon = (name) =>
  `<span class="icon" aria-hidden="true">${esc(name)}</span>`;
export const button = (label, action, style = "white", extra = "") =>
  `<button type="button" class="button ${style}" data-action="${esc(action)}" ${extra}>${label}</button>`;
export const empty = (label = "Chưa có dữ liệu") =>
  `<div class="empty">${icon("inbox")}<div>${esc(label)}</div></div>`;
export const pill = (status) =>
  `<span class="pill ${esc(status)}">${{ paid: "Đã thanh toán", partial: "Trả một phần", unpaid: "Còn nợ", overdue: "Quá hạn" }[status] || esc(status)}</span>`;
export const field = (label, name, value = "", type = "text", options = "") =>
  type === "date"
    ? `<div class="field"><label for="f-${esc(name)}">${esc(label)}</label><div class="date-field"><span class="date-display">${esc(dateText(value))}</span>${icon("calendar_month")}<input id="f-${esc(name)}" name="${esc(name)}" type="date" lang="vi-VN" value="${esc(value)}" ${options}></div></div>`
    : `<div class="field"><label for="f-${esc(name)}">${esc(label)}</label><input id="f-${esc(name)}" name="${esc(name)}" type="${type}" value="${esc(value)}" ${type === "number" ? 'min="0" step="any" inputmode="decimal"' : ""} ${options}></div>`;
export const select = (label, name, options, current = "") =>
  `<div class="field"><label for="f-${esc(name)}">${esc(label)}</label><select id="f-${esc(name)}" name="${esc(name)}">${options.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(current) ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></div>`;
export const textarea = (label, name, value = "") =>
  `<div class="field full"><label for="f-${esc(name)}">${esc(label)}</label><textarea id="f-${esc(name)}" name="${esc(name)}">${esc(value)}</textarea></div>`;
export const formData = (form) =>
  Object.fromEntries(new FormData(form).entries());
export function checkNumbers(form) {
  for (const input of form.querySelectorAll("input[type=number]")) {
    if (
      input.value !== "" &&
      (!input.validity.valid ||
        Number(input.value) < 0 ||
        !Number.isFinite(Number(input.value)))
    ) {
      input.focus();
      throw Error(
        `${input.closest(".field")?.querySelector("label")?.textContent || "Giá trị"} phải là số không âm.`,
      );
    }
  }
}
export function bindNonnegative() {
  document.addEventListener("keydown", (e) => {
    if (
      e.target?.matches?.("input[type=number]") &&
      ["-", "e", "E", "+"].includes(e.key)
    )
      e.preventDefault();
  });
  document.addEventListener("input", (e) => {
    if (e.target?.matches?.("input[type=number]") && Number(e.target.value) < 0)
      e.target.value = "";
  });
  document.addEventListener("paste", (e) => {
    if (
      e.target?.matches?.("input[type=number]") &&
      /-/.test(e.clipboardData?.getData("text") || "")
    )
      e.preventDefault();
  });
}
export function bindDateDisplays() {
  const sync = (event) => {
    if (!event.target?.matches?.(".date-field input[type=date]")) return;
    event.target.parentElement.querySelector(".date-display").textContent =
      dateText(event.target.value);
  };
  document.addEventListener("input", sync);
  document.addEventListener("change", sync);
}
