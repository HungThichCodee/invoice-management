'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ExcelJS = require('exceljs');
const imports = require('./services/imports');
const { capture } = require('./smokeReady');
const { answer } = require('./smokeInteractions');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(contents, expression) {
  for (let i = 0; i < 50; i++) {
    if (await contents.executeJavaScript(expression)) return;
    await pause(100);
  }
  throw Error(`Luồng xem trước file nhập chưa sẵn sàng: ${expression}`);
}
async function prepare(state, base) {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('Hóa đơn').addRows([
    ['Mã HĐ', 'Ngày', 'Hạn trả', 'Khách hàng', 'Tổng tiền'],
    ['OLD-BAD', '2026-02-31', '2026-10-30', 'Khách lỗi', 100],
    ['OLD-GOOD', '2026-10-01', '2026-10-30', 'Khách hợp lệ', 500],
  ]);
  workbook.addWorksheet('Chi tiết').addRows([
    ['Mã HĐ', 'Tên', 'Số lượng', 'Đơn giá'],
    ['OLD-BAD', 'Hàng lỗi', 1, 100],
    ['OLD-GOOD', 'Hàng cần sửa', 1, -500],
  ]);
  workbook.addWorksheet('Thu tiền').addRows([
    ['Mã HĐ', 'Ngày', 'Số tiền'], ['OLD-BAD', '2026-10-02', 100],
  ]);
  workbook.addWorksheet('Khách hàng').addRows([
    ['Tên khách', 'Số điện thoại'], ['Khách hợp lệ', ''],
  ]);
  const file = path.join(base, 'smoke-import.xlsx');
  await workbook.xlsx.writeFile(file);
  try { state.importSession = { name: path.basename(file), sheets: await imports.read(file) }; }
  finally { fs.unlinkSync(file); }
}
async function exercise(state, base) {
  const contents = state.window.webContents;
  await contents.executeJavaScript("document.querySelector('[data-action=preview]').click();true");
  await waitFor(contents, "document.querySelectorAll('.import-errors tbody tr').length===3");
  await capture(state.window, path.join(base, 'importPreviewErrors.png'));
  await contents.executeJavaScript("[...document.querySelectorAll('.import-errors tbody tr')].find(row=>row.textContent.includes('Đơn giá')).querySelector('[data-action^=edit]').click();true");
  await waitFor(contents, "!!document.querySelector('#modal-root input[name=price]')");
  const edit = await contents.executeJavaScript("(()=>{const input=document.querySelector('#modal-root input[name=price]');return {type:input.type,min:input.min,value:input.value}})()");
  if (edit.type !== 'number' || edit.min !== '0' || edit.value !== '-500') throw Error(`Sửa dòng nhập thiếu kiểm tra số âm: ${JSON.stringify(edit)}`);
  await contents.executeJavaScript("(()=>{const input=document.querySelector('#modal-root input[name=price]');input.value='500';input.dispatchEvent(new Event('input',{bubbles:true}));input.closest('form').requestSubmit();return true})()");
  await answer(contents);
  await waitFor(contents, "!document.querySelector('#modal-root .modal') && document.querySelectorAll('.import-errors tbody tr').length===2");
  await contents.executeJavaScript("document.querySelector('[data-action=skipErrors]').click();true");
  await answer(contents);
  await waitFor(contents, "document.querySelector('.import-status-card.bad strong')?.textContent.includes('0 dòng') && document.querySelector('.import-status-card.caution strong')?.textContent.includes('1 dòng')");
  await capture(state.window, path.join(base, 'importPreviewReady.png'));
  await contents.executeJavaScript("document.querySelector('[data-action=commit]').click();true");
  await answer(contents);
  await waitFor(contents, "document.querySelector('#page')?.textContent.includes('smoke-import.xlsx') && !document.querySelector('[data-action=preview]')");
  const saved = imports.history(state.store)[0];
  if (!saved || saved.source_name !== 'smoke-import.xlsx') throw Error('Không ghi được lịch sử nhập dữ liệu.');
}
module.exports = { prepare, exercise };
