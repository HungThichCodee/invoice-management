'use strict';
const { BrowserWindow, dialog } = require('electron');
const { installCloseGuard } = require('./closeGuard');
const pause = () => new Promise(resolve => setTimeout(resolve, 150));

async function exercise(state) {
  const window = new BrowserWindow({ show: false, webPreferences: {
    nodeIntegration: false, contextIsolation: true, sandbox: true
  } });
  const original = dialog.showMessageBox;
  try {
    await window.loadURL('data:text/html,<title>close-guard-smoke</title>');
    await window.webContents.executeJavaScript(`window.__invoiceHasPendingChanges=()=>true;
      window.__invoiceIsSaving=()=>true;true`);
    installCloseGuard(window, state.log);
    dialog.showMessageBox = async () => ({ response: 0 });
    window.close();
    await pause();
    if (window.isDestroyed()) throw Error('Đóng cửa sổ khi dữ liệu còn đang lưu.');
    await window.webContents.executeJavaScript('window.__invoiceIsSaving=()=>false;true');
    window.close();
    await pause();
    if (window.isDestroyed()) throw Error('Hủy đóng cửa sổ vẫn thoát ứng dụng.');
    dialog.showMessageBox = async () => ({ response: 1 });
    window.close();
    await pause();
    if (!window.isDestroyed()) throw Error('Xác nhận đóng cửa sổ không hoạt động.');
    console.log('Window close: busy and cancel blocked; confirmed close succeeded.');
  } finally {
    dialog.showMessageBox = original;
    if (!window.isDestroyed()) window.destroy();
  }
}
module.exports = { exercise };
