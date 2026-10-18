'use strict';
const fs = require('node:fs');
const path = require('node:path');
const exporter = require('./services/exports');

async function exercise(state) {
  const folder = exporter.folder(state.store);
  const files = () => fs.readdirSync(folder).filter(name => name.startsWith('Phieu_thu_') && name.endsWith('.pdf'));
  const before = new Set(files());
  const button = await state.window.webContents.executeJavaScript(
    "(()=>{const element=document.querySelector('[data-action^=\"print:\"]');if(!element)return null;const action=element.dataset.action;element.click();return action})()");
  if (!button) throw Error('Danh sách phiếu thu thiếu nút in.');
  let printed;
  for (let i = 0; i < 80; i++) {
    printed = files().find(name => !before.has(name));
    if (printed && fs.statSync(path.join(folder, printed)).size > 1000) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!printed || fs.readFileSync(path.join(folder, printed)).subarray(0, 5).toString() !== '%PDF-')
    throw Error('Nút in phiếu thu không tạo PDF hợp lệ.');
}
module.exports = { exercise };
