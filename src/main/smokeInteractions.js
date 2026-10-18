"use strict";
const path = require("node:path");
const { captureDesign } = require("./smokeReady");
const pause = () => new Promise((resolve) => setTimeout(resolve, 180));
async function answer(web, accept = true) {
  const visible = await web.executeJavaScript(`(async()=>{
    for(let i=0;i<40;i++){
      const button=document.querySelector('#confirm-root [data-action=${accept ? "accept" : "reject"}]');
      if(button)return {message:document.querySelector('#confirmation-message')?.textContent,
        button:button.textContent,confirmLabel:document.querySelector('#confirm-root [data-action=accept]')?.textContent,
        danger:document.querySelector('#confirm-root [data-action=accept]')?.classList.contains('solid')};
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    return null;
  })()`);
  if (!visible) throw Error("Không hiển thị hộp thoại xác nhận.");
  await web.executeJavaScript(
    `document.querySelector('#confirm-root [data-action=${accept ? "accept" : "reject"}]').click();true`,
  );
  await pause();
  return visible;
}
async function exercise(state, base) {
  const web = state.window.webContents;
  const before = await web.executeJavaScript(
    "window.invoiceApi['invoices.list']({}).then(rows=>rows.length)",
  );
  await web.executeJavaScript(
    "document.querySelector('[data-route=invoiceForm]').click();true",
  );
  await pause();
  const opened = await web.executeJavaScript(
    "({form:!!document.querySelector('#invoiceForm'),count:document.querySelectorAll('#invoiceForm .line-item').length})",
  );
  if (!opened.form || opened.count !== 1)
    throw Error(`Form tạo hóa đơn không mở: ${JSON.stringify(opened)}`);
  const afterOpen = await web.executeJavaScript(
    "window.invoiceApi['invoices.list']({}).then(rows=>rows.length)",
  );
  if (afterOpen !== before)
    throw Error("Mở form tạo đã ghi hóa đơn trước khi lưu.");
  await web.executeJavaScript(`(()=>{const input=document.querySelector('[name=itemName]');input.value='Dịch vụ đang nhập dở';
    input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-action=save]').click();return true})()`);
  await answer(web);
  const failure = await web.executeJavaScript(`(async()=>({
    count:(await window.invoiceApi['invoices.list']({})).length,
    toast:document.querySelector('#toast-root')?.textContent}))()`);
  if (failure.count !== before || !failure.toast.includes('Không thể thực hiện:'))
    throw Error(`Lỗi lưu hóa đơn chưa hiện lý do: ${JSON.stringify(failure)}`);
  await web.executeJavaScript("document.querySelector('[data-action=back]').click();true");
  await captureDesign(
    state.window,
    path.join(base, "confirmation-mobile.png"),
    390,
    844,
  );
  const prompt = await answer(web, false);
  if (!prompt.message.includes("thay đổi chưa lưu"))
    throw Error("Cảnh báo bỏ form thiếu nội dung.");
  const stayed = await web.executeJavaScript(
    "!!document.querySelector('#invoiceForm')",
  );
  if (!stayed) throw Error("Hủy cảnh báo vẫn rời form.");
  await web.executeJavaScript(
    "document.querySelector('[data-action=back]').click();true",
  );
  await answer(web);
  const afterCancel = await web.executeJavaScript(
    "window.invoiceApi['invoices.list']({}).then(rows=>rows.length)",
  );
  if (afterCancel !== before) throw Error("Thoát form tạo vẫn lưu hóa đơn.");
  await web.executeJavaScript(
    "document.querySelector('[data-route=customers]').click();true",
  );
  await pause();
  const customerBefore = await web.executeJavaScript(
    "window.invoiceApi['customers.list']('').then(rows=>rows.length)",
  );
  await web.executeJavaScript(
    `(()=>{document.querySelector('[data-action=add]').click();return true})()`,
  );
  await pause();
  await web.executeJavaScript(`(()=>{const input=document.querySelector('#customerForm [name=name]');
    input.value='Khách đang nhập dở';input.dispatchEvent(new Event('input',{bubbles:true}));
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return true})()`);
  await answer(web, false);
  if (
    !(await web.executeJavaScript("!!document.querySelector('#customerForm')"))
  )
    throw Error("Hủy cảnh báo Esc vẫn đóng form.");
  await web.executeJavaScript(
    "document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));true",
  );
  await answer(web);
  await web.executeJavaScript(
    "document.querySelector('[data-action=add]').click();true",
  );
  await pause();
  await web.executeJavaScript(`(()=>{const input=document.querySelector('#customerForm [name=name]');
    input.value='Khách bỏ khi bấm nền';input.dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelector('#modal-root .overlay').click();return true})()`);
  await answer(web);
  const customerAfter = await web.executeJavaScript(
    "window.invoiceApi['customers.list']('').then(rows=>rows.length)",
  );
  if (customerAfter !== customerBefore)
    throw Error("Esc hoặc bấm nền đã lưu khách hàng chưa xác nhận.");
  await web.executeJavaScript(
    "document.querySelector('[data-route=invoiceForm]').click();true",
  );
  await pause();
  await web.executeJavaScript(`(()=>{const input=document.querySelector('[name=itemName]');
    input.value='Dịch vụ chờ Back';input.dispatchEvent(new Event('input',{bubbles:true}));history.back();return true})()`);
  await answer(web, false);
  if (
    !(await web.executeJavaScript("!!document.querySelector('#invoiceForm')"))
  )
    throw Error("Hủy cảnh báo Back vẫn rời form.");
  await web.executeJavaScript("history.back();true");
  await answer(web);
  const afterBack = await web.executeJavaScript(
    "window.invoiceApi['invoices.list']({}).then(rows=>rows.length)",
  );
  if (afterBack !== before) throw Error("Back đã lưu hóa đơn chưa xác nhận.");
  await web.executeJavaScript(
    "document.querySelector('[data-route=invoiceForm]').click();true",
  );
  await pause();
  const beforeReload =
    await web.executeJavaScript(`(()=>{const input=document.querySelector('[name=itemName]');
    input.value='Dịch vụ chờ tải lại';input.dispatchEvent(new Event('input',{bubbles:true}));
    const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);
    return {dirty:window.__invoiceHasPendingChanges(),blocked:event.defaultPrevented}})()`);
  if (!beforeReload.dirty || !beforeReload.blocked)
    throw Error("Tải lại không cảnh báo form chưa lưu.");
  await web.executeJavaScript("window.__invoiceExitApproved=true;true");
  const reloaded = new Promise((resolve) =>
    web.once("did-finish-load", resolve),
  );
  web.reload();
  await reloaded;
  await pause();
  const afterReload = await web.executeJavaScript(
    "window.invoiceApi['invoices.list']({}).then(rows=>rows.length)",
  );
  if (afterReload !== before)
    throw Error("Tải lại đã lưu hóa đơn chưa xác nhận.");
  await web.executeJavaScript(
    "document.querySelector('[data-route=invoiceForm]').click();true",
  );
  await pause();
  await web.executeJavaScript(`(()=>{const form=document.querySelector('#invoiceForm');
    form.elements.customerId.value=form.elements.customerId.querySelector('option:not([value=""])').value;
    form.elements.itemName.value='Dịch vụ xác nhận tạo';form.elements.itemPrice.value='100000';
    form.elements.itemName.dispatchEvent(new Event('input',{bubbles:true}));
    form.querySelector('[data-action=save]').click();return true})()`);
  await answer(web, false);
  const canceledSave = await web.executeJavaScript(
    "window.invoiceApi['invoices.list']({}).then(rows=>rows.length)",
  );
  if (canceledSave !== before) throw Error("Hủy xác nhận tạo vẫn ghi hóa đơn.");
  await web.executeJavaScript(
    "document.querySelector('#invoiceForm [data-action=save]').click();true",
  );
  await answer(web);
  const created = await web.executeJavaScript(`(async()=>{
    const rows=await window.invoiceApi['invoices.list']({});
    return {count:rows.length,id:rows.find(row=>row.total===100000)?.id,
      toast:document.querySelector('#toast-root')?.textContent};})()`);
  if (
    created.count !== before + 1 ||
    !created.id ||
    !created.toast.includes("Tạo hóa đơn thành công")
  )
    throw Error(`Tạo có xác nhận thất bại: ${JSON.stringify(created)}`);
  await web.executeJavaScript(
    `document.querySelector('[data-detail="${created.id}"]').click();true`,
  );
  await pause();
  await web.executeJavaScript(
    "document.querySelector('#modal-root [data-action=delete]').click();true",
  );
  const deletion = await answer(web, false);
  if (!deletion.danger || !deletion.confirmLabel.includes("Xóa"))
    throw Error("Hộp xóa thiếu nút cảnh báo.");
  const afterDeleteCancel = await web.executeJavaScript(
    "window.invoiceApi['invoices.list']({}).then(rows=>rows.length)",
  );
  if (afterDeleteCancel !== before + 1) throw Error("Hủy xóa vẫn xóa hóa đơn.");
  await web.executeJavaScript(
    "document.querySelector('#modal-root [data-action=delete]').click();true",
  );
  await answer(web);
  const afterDelete = await web.executeJavaScript(
    "window.invoiceApi['invoices.list']({}).then(rows=>rows.length)",
  );
  if (afterDelete !== before)
    throw Error("Xóa có xác nhận không cập nhật dữ liệu.");
  state.importSession = { name: 'draft.xlsx', sheets: [{ name: 'Hóa đơn', rows: [] }] };
  await web.executeJavaScript("document.querySelector('[data-route=imports]').click();true");
  await pause();
  await web.executeJavaScript("document.querySelector('[data-route=dashboard]').click();true");
  await answer(web, false);
  if (!state.importSession || !(await web.executeJavaScript("document.querySelector('#page h1')?.textContent.includes('Nhập / Xuất')")))
    throw Error('Hủy cảnh báo nhập liệu vẫn xóa phiên tạm.');
  await web.executeJavaScript("document.querySelector('[data-route=dashboard]').click();true");
  await answer(web);
  if (state.importSession) throw Error('Rời màn nhập chưa dọn phiên tạm.');
  await web.executeJavaScript("document.querySelector('[data-route=backups]').click();true");
  await pause();
  const keepBefore = await web.executeJavaScript("window.invoiceApi['settings.get']().then(s=>s.backupKeep)");
  await web.executeJavaScript(`(()=>{const input=document.querySelector('#keep');input.value='99';
    input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-route=dashboard]').click();return true})()`);
  await answer(web, false);
  if (!(await web.executeJavaScript("!!document.querySelector('.backup-settings')")))
    throw Error('Hủy cảnh báo cấu hình sao lưu vẫn rời form.');
  await web.executeJavaScript("document.querySelector('[data-route=dashboard]').click();true");
  await answer(web);
  const keepAfter = await web.executeJavaScript("window.invoiceApi['settings.get']().then(s=>s.backupKeep)");
  if (String(keepAfter) !== String(keepBefore)) throw Error('Rời cấu hình sao lưu đã lưu dữ liệu chưa xác nhận.');
  console.log("Form cancel: no invoice inserted; discard confirmation works.");
}
async function collectDashboard(state, invoiceId) {
  const web = state.window.webContents;
  await web.executeJavaScript(
    "document.querySelector('[data-action^=\"collect:\"]').click();true",
  );
  await new Promise((resolve) => setTimeout(resolve, 350));
  const opened = await web.executeJavaScript(
    "!!document.querySelector('#paymentForm')",
  );
  if (!opened) throw Error("Không mở được hộp thu tiền từ dashboard.");
  await web.executeJavaScript(
    "(()=>{const form=document.querySelector('#paymentForm');form.querySelector('[name=amount]').value='1000';form.requestSubmit();return true})()",
  );
  await answer(web);
  const collection =
    await web.executeJavaScript(`(async()=>{await new Promise(resolve=>setTimeout(resolve,350));
    return {stillOpen:!!document.querySelector('#paymentForm'),count:(await window.invoiceApi['payments.list']({invoiceId:'${invoiceId}'})).length};})()`);
  if (collection.stillOpen || collection.count !== 3)
    throw Error(
      `Thu tiền từ dashboard chưa hoàn tất: ${JSON.stringify(collection)}`,
    );
  console.log(`Deep link payment: ${JSON.stringify(collection)}`);
}
module.exports = { answer, exercise, collectDashboard };
