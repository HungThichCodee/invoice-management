'use strict';
const { dialog } = require('electron');
const backups = require('./services/backups');
const customers = require('./services/customers');

async function exercise(state) {
  const before = customers.list(state.store).length;
  const snapshot = await backups.create(state.store, 'smoke_restore');
  customers.create(state.store, { name: 'Khách chỉ có sau bản sao' });
  const original = dialog.showMessageBox;
  const invoke = () => state.window.webContents.executeJavaScript(
    `window.invoiceApi["backups.restoreNamed"](${JSON.stringify(snapshot.name)})`);
  try {
    dialog.showMessageBox = async () => ({ response: 0 });
    if (await invoke() !== false || customers.list(state.store).length !== before + 1)
      throw Error('Hủy khôi phục vẫn làm thay đổi dữ liệu.');
    dialog.showMessageBox = async () => ({ response: 1 });
    if (await invoke() !== true || customers.list(state.store).length !== before)
      throw Error('Khôi phục bản đã chọn qua IPC không phục hồi dữ liệu.');
  } finally {
    dialog.showMessageBox = original;
  }
}
module.exports = { exercise };
