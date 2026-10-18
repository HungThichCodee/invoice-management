'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { BrowserWindow, clipboard, dialog, ipcMain, shell } = require('electron');
const customers = require('./services/customers');
const invoices = require('./services/invoices');
const payments = require('./services/payments');
const reports = require('./services/reports');
const imports = require('./services/imports');
const exporter = require('./services/exports');
const backups = require('./services/backups');
const settings = require('./services/settings');
const logo = require('./services/logo');
const dataLocation = require('./services/dataLocation');

function register(state) {
  async function confirmRestore(source) {
    const confirm = await dialog.showMessageBox(state.window, { type: 'warning', buttons: ['Hủy', 'Khôi phục'],
      defaultId: 0, cancelId: 0, message: 'Khôi phục sẽ thay thế dữ liệu hiện tại. Bản hiện tại sẽ được sao lưu trước.' });
    return confirm.response === 1 ? backups.restore(state, source) : false;
  }
  const handlers = {
    'app.ready': () => {
      state.uiReady = true;
      if (!state.smoke && !state.window.isVisible()) state.window.show();
      return true;
    },
    'customers.list': q => customers.list(state.store, q),
    'customers.get': id => customers.get(state.store, id),
    'customers.create': v => customers.create(state.store, v),
    'customers.update': v => customers.update(state.store, v),
    'customers.remove': id => customers.remove(state.store, id),
    'invoices.list': v => invoices.list(state.store, v),
    'invoices.get': id => invoices.get(state.store, id),
    'invoices.create': v => invoices.create(state.store, v),
    'invoices.update': v => invoices.update(state.store, v),
    'invoices.remove': id => invoices.remove(state.store, id),
    'payments.list': v => payments.list(state.store, v),
    'payments.create': v => payments.create(state.store, v),
    'payments.update': v => payments.update(state.store, v),
    'payments.remove': id => payments.remove(state.store, id),
    'debts.allocate': v => payments.allocate(state.store, v),
    'debts.collect': v => payments.bulk(state.store, v),
    'reports.dashboard': v => reports.dashboard(state.store, v),
    'reports.activity': v => reports.activity(state.store, v),
    'reports.periods': v => reports.periods(state.store, v.year, v.mode),
    'reports.month': v => reports.monthDetail(state.store, v),
    'imports.history': () => imports.history(state.store),
    'imports.session': () => state.importSession ? { name: state.importSession.name,
      sheets: state.importSession.sheets.map(s => ({ name: s.name, count: s.rows.length })) } : null,
    'imports.cancel': () => { state.importSession = null; return true; },
    'imports.choose': async () => {
      const result = await dialog.showOpenDialog(state.window, { properties: ['openFile'],
        filters: [{ name: 'Excel và CSV', extensions: ['xlsx', 'csv'] }] });
      if (result.canceled) return null;
      const name = path.basename(result.filePaths[0]);
      state.importSession = { name, sheets: await imports.read(result.filePaths[0]) };
      return { name, sheets: state.importSession.sheets.map(s => ({ name: s.name, count: s.rows.length })) };
    },
    'imports.preview': () => {
      if (!state.importSession) throw Error('Hãy chọn file trước.');
      return imports.preview(state.importSession.sheets, state.store);
    },
    'imports.updateRow': input => {
      if (!state.importSession) throw Error('Hãy chọn file trước.');
      const sheet = state.importSession.sheets.find(s => s.name === input.sheet);
      const row = sheet?.rows.find(r => r._line === Number(input.line));
      if (!row) throw Error('Không tìm thấy dòng cần sửa.');
      const allowed = new Set(['code','invoice','customer','customerCode','phone','address','date','due','total','taxRate','discount','name','qty','price','amount','method','unit','kind','model','serial','capacity','hours']);
      for (const [key, value] of Object.entries(input.values || {})) if (allowed.has(key)) row[key] = String(value).slice(0, 500);
      return imports.preview(state.importSession.sheets, state.store);
    },
    'imports.skipErrors': () => {
      if (!state.importSession) throw Error('Hãy chọn file trước.');
      return imports.skipInvalidRows(state.importSession, state.store);
    },
    'imports.commit': async strategy => {
      if (!state.importSession) throw Error('Hãy chọn file trước.');
      const result = await imports.commit(state.store, state.importSession, strategy);
      state.importSession = null;
      return result;
    },
    'imports.undo': () => imports.undo(state.store),
    'exports.csv': v => exporter.csv(state.store, v.kind, v.filter),
    'exports.excel': v => exporter.excel(state.store, v),
    'exports.pdf': async v => {
      const labels = { invoice:'Hoa_don', receipt:'Phieu_thu', invoices:'Danh_sach_hoa_don', payments:'So_quy', report:'Bao_cao', debts:'Doi_chieu_cong_no' };
      if (!labels[v.kind]) throw Error('Loại PDF không hợp lệ.');
      const target = exporter.file(state.store, labels[v.kind], 'pdf');
      const printWindow = new BrowserWindow({ show: false, webPreferences: { sandbox: true, nodeIntegration: false } });
      try {
        await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(exporter.printHtml(state.store, v.kind, v.filter))}`);
        const bytes = await printWindow.webContents.printToPDF({ pageSize: 'A4', printBackground: true });
        fs.writeFileSync(target, bytes);
        return target;
      } finally { printWindow.close(); }
    },
    'backups.list': () => backups.list(state.store),
    'backups.create': () => backups.create(state.store),
    'backups.prune': () => backups.prune(state.store),
    'backups.restoreNamed': async name => {
      const entry = backups.list(state.store).find(x => x.name === name);
      if (!entry) throw Error('Không tìm thấy bản sao lưu.');
      return confirmRestore(path.join(backups.dirFor(state.store), entry.name));
    },
    'backups.copy': async name => {
      const entry = backups.list(state.store).find(x => x.name === name);
      if (!entry) throw Error('Không tìm thấy bản sao lưu.');
      const result = await dialog.showSaveDialog(state.window, { defaultPath: entry.name,
        filters: [{ name: 'SQLite', extensions: ['db'] }] });
      if (result.canceled) return null;
      fs.copyFileSync(path.join(backups.dirFor(state.store), entry.name), result.filePath);
      return result.filePath;
    },
    'backups.restore': async () => {
      const result = await dialog.showOpenDialog(state.window, { properties: ['openFile'],
        defaultPath: backups.dirFor(state.store), filters: [{ name: 'SQLite', extensions: ['db'] }] });
      if (result.canceled) return false;
      return confirmRestore(result.filePaths[0]);
    },
    'settings.get': () => { const values = settings.get(state.store); return { ...values, dataFolder: state.store.folder, logoData: logo.dataUrl(state.store, values.sellerLogo),
      invoiceCounter: state.store.get("SELECT value FROM sequences WHERE kind='invoice'")?.value || 0,
      paymentCounter: state.store.get("SELECT value FROM sequences WHERE kind='payment'")?.value || 0 }; },
    'settings.update': v => settings.update(state.store, v),
    'settings.chooseFolder': async kind => {
      const result = await dialog.showOpenDialog(state.window, { properties: ['openDirectory', 'createDirectory'] });
      if (result.canceled) return null;
      const folder = result.filePaths[0];
      if (kind === 'export') settings.update(state.store, { exportFolder: folder });
      else if (kind === 'data') return dataLocation.move(state, folder);
      else throw Error('Loại thư mục không hợp lệ.');
      return folder;
    },
    'settings.chooseLogo': async () => {
      const result = await dialog.showOpenDialog(state.window, { properties: ['openFile'],
        filters: [{ name: 'Ảnh', extensions: ['png', 'jpg', 'jpeg'] }] });
      if (result.canceled) return null;
      return logo.save(state.store, result.filePaths[0]);
    },
    'settings.removeLogo': () => logo.remove(state.store),
    'reminders.copy': message => { clipboard.writeText(String(message || '').slice(0, 2000)); return true; },
    'files.openFolder': kind => shell.openPath(kind === 'backup' ? backups.dirFor(state.store) : kind === 'data' ? state.store.folder : exporter.folder(state.store))
  };
  for (const [name, fn] of Object.entries(handlers)) {
    ipcMain.handle(name, async (event, value) => {
      if (event.sender !== state.window.webContents) throw Error('Nguồn gọi không hợp lệ.');
      try { return await fn(value); }
      catch (error) { state.log(`${name}: ${error.stack || error.message}`); throw Error(error.message); }
    });
  }
}
module.exports = { register };
