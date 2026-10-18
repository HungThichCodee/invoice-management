"use strict";
const { dialog } = require("electron");

function installCloseGuard(window, log) {
  let approved = false;
  window.on("close", (event) => {
    if (approved) return;
    event.preventDefault();
    Promise.resolve()
      .then(async () => {
        const saving = await window.webContents.executeJavaScript(
          "window.__invoiceIsSaving?.() || false",
        );
        if (saving) {
          await dialog.showMessageBox(window, {
            type: "info",
            buttons: ["Đã hiểu"],
            message: "Dữ liệu đang được lưu. Vui lòng chờ thao tác hoàn tất.",
          });
          return;
        }
        const dirty = await window.webContents.executeJavaScript(
          "window.__invoiceHasPendingChanges?.() || false",
        );
        if (dirty) {
          const answer = await dialog.showMessageBox(window, {
            type: "warning",
            buttons: ["Tiếp tục nhập", "Thoát và bỏ thay đổi"],
            defaultId: 0,
            cancelId: 0,
            message:
              "Bạn có thay đổi chưa lưu, thoát sẽ mất dữ liệu. Bạn có chắc không?",
          });
          if (answer.response !== 1) return;
        }
        approved = true;
        await window.webContents.executeJavaScript(
          "window.__invoiceExitApproved = true",
        );
        window.close();
      })
      .catch((error) => log(`close guard: ${error.message}`));
  });
}
module.exports = { installCloseGuard };
