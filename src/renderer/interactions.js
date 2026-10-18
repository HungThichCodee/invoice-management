import { button, esc, icon } from "./ui.js";

const discardMessage =
  "Bạn có thay đổi chưa lưu, thoát sẽ mất dữ liệu. Bạn có chắc không?";
const values = (form) => [
  ...[...form.querySelectorAll("input,select,textarea")]
    .filter((input) => input.type !== "file")
    .map((input, index) =>
      `${input.name || input.dataset.allocation || `unnamed${index}`}:${input.type === "checkbox" ? input.checked : input.value}`),
  ...[...form.querySelectorAll("[data-mode],[data-strategy],[data-method]")]
    .map((control, index) => `choice${index}:${control.classList.contains("active")}`),
].join("\u001f");

export function createInteractions(toast) {
  let pageForm = null;
  let modalForm = null;
  let pending = false;
  const modalRoot = () => document.getElementById("modal-root");
  const confirmRoot = () => document.getElementById("confirm-root");
  const dirty = (entry) =>
    !!entry?.form.isConnected &&
    (entry.changed || values(entry.form) !== entry.initial);
  const track = (form, scope) => {
    const entry = { form, initial: values(form), changed: false };
    if (scope === "modal") modalForm = entry;
    else pageForm = entry;
    return {
      mark: () => {
        entry.changed = true;
      },
      reset: () => {
        entry.initial = values(form);
        entry.changed = false;
      },
    };
  };
  function syncSavedField(name, value) {
    if (!pageForm?.form.isConnected) return;
    const input = pageForm.form.elements.namedItem(name);
    if (!input) return;
    if (input.type === "checkbox") input.checked = !!value;
    else input.value = String(value);
    const parts = pageForm.initial.split("\u001f");
    const index = parts.findIndex((part) => part.startsWith(`${name}:`));
    if (index >= 0)
      parts[index] = `${name}:${input.type === "checkbox" ? input.checked : input.value}`;
    pageForm.initial = parts.join("\u001f");
  }
  function ask({
    title = "Xác nhận thao tác",
    message,
    label = "Xác nhận",
    danger = false,
  }) {
    if (confirmRoot().firstElementChild) return Promise.resolve(false);
    return new Promise((resolve) => {
      const root = confirmRoot();
      root.innerHTML = `<div class="overlay confirmation-overlay"><section class="modal confirmation" role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-message">
        <div class="confirmation-icon ${danger ? "danger" : ""}">${icon(danger ? "warning" : "help")}</div>
        <h2 id="confirmation-title">${esc(title)}</h2><p id="confirmation-message">${esc(message)}</p>
        <div class="form-actions">${button("Hủy", "reject", "white")}${button(esc(label), "accept", danger ? "danger solid" : "primary")}</div></section></div>`;
      const finish = (answer) => {
        root.innerHTML = "";
        resolve(answer);
      };
      root.querySelector("[data-action=reject]").onclick = () => finish(false);
      root.querySelector("[data-action=accept]").onclick = () => finish(true);
      root.querySelector(".overlay").onclick = (event) => {
        if (event.target.classList.contains("overlay")) finish(false);
      };
      root.querySelector("[data-action=reject]").focus();
    });
  }
  async function leave(scope = "all") {
    if (pending) return false;
    if (
      !(scope === "modal"
        ? dirty(modalForm)
        : dirty(modalForm) || dirty(pageForm))
    )
      return true;
    const ok = await ask({
      title: "Bỏ thay đổi?",
      message: discardMessage,
      label: "Thoát và bỏ thay đổi",
      danger: true,
    });
    if (ok) {
      modalForm = null;
      if (scope !== "modal") pageForm = null;
      toast("Đã hủy thay đổi.");
    }
    return ok;
  }
  async function closeModal(force = false) {
    if (!modalRoot().firstElementChild) return true;
    const form = !!modalForm;
    const changed = dirty(modalForm);
    if (!force && (pending || (changed && !(await leave("modal")))))
      return false;
    modalRoot().innerHTML = "";
    modalForm = null;
    if (form && !changed && !force) toast("Đã hủy.");
    return true;
  }
  function modal(html, onOpen) {
    const root = modalRoot();
    root.innerHTML = `<div class="overlay"><div class="modal">${html}</div></div>`;
    const box = root.querySelector(".modal");
    root.querySelector(".overlay").addEventListener("click", (event) => {
      if (event.target.classList.contains("overlay")) closeModal();
    });
    root
      .querySelectorAll("[data-close]")
      .forEach((node) => node.addEventListener("click", () => closeModal()));
    onOpen?.(box);
    const form = box.querySelector("form");
    modalForm = form ? { form, initial: values(form), changed: false } : null;
    return box;
  }
  async function perform(node, options, task) {
    if (pending) return { ok: false };
    if (options.message && !(await ask(options))) return { ok: false };
    if (pending) return { ok: false };
    pending = true;
    const controls = [
      ...new Set([
        node,
        ...(node
          ?.closest("form")
          ?.querySelectorAll(
            '[type="submit"],[data-action="save"],[data-action="savePay"],[data-action="savePdf"]',
          ) || []),
      ]),
    ].filter(Boolean);
    const originals = controls.map((control) => ({
      control,
      disabled: control.disabled,
      html: control.innerHTML,
    }));
    for (const { control } of originals) control.disabled = true;
    if (node) node.textContent = options.loading || "Đang xử lý…";
    try {
      const result = await task();
      if (options.success) toast(options.success);
      return { ok: true, result };
    } catch (error) {
      toast(
        `Không thể thực hiện: ${error.message || "Lỗi không xác định."}`,
        true,
      );
      return { ok: false, error };
    } finally {
      pending = false;
      for (const { control, disabled, html } of originals) {
        if (control.isConnected) {
          control.disabled = disabled;
          control.innerHTML = html;
        }
      }
    }
  }
  return {
    ask,
    leave,
    closeModal,
    modal,
    perform,
    trackPage: (form) => track(form, "page"),
    syncSavedField,
    markPage: () => {
      if (pageForm) pageForm.changed = true;
    },
    resetPage: () => {
      pageForm = null;
    },
    isDirty: () => dirty(pageForm) || dirty(modalForm),
    isPending: () => pending,
    hasConfirm: () => !!confirmRoot().firstElementChild,
    cancelConfirm: () =>
      confirmRoot().querySelector("[data-action=reject]")?.click(),
  };
}
