"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { capture } = require("./smokeReady");
const smokeReceipt = require("./smokeReceipt");
const smokeInteractions = require("./smokeInteractions");
async function exercise(route, state, base, scenario) {
          if (route === "invoices") {
            const filters = await state.window.webContents.executeJavaScript(
              "({tabs:document.querySelectorAll('[data-status-tab]').length,months:document.querySelector('#invoiceMonth')?.options.length,customers:document.querySelector('#invoiceCustomer')?.options.length,search:document.querySelector('#search')?.value})",
            );
            if (
              filters.tabs !== 4 ||
              filters.months < 2 ||
              filters.customers < 2 ||
              filters.search
            )
              throw Error(
                `Bộ lọc hóa đơn thiếu hoặc chưa đặt lại: ${JSON.stringify(filters)}`,
              );
            await state.window.webContents.executeJavaScript(
              "document.querySelector('[data-status-tab=overdue]').click();true",
            );
            await new Promise((resolve) => setTimeout(resolve, 180));
            const overdueTab = await state.window.webContents.executeJavaScript(
              "document.querySelector('[data-status-tab=overdue]')?.classList.contains('active')",
            );
            if (!overdueTab)
              throw Error("Tab hóa đơn quá hạn không giữ bộ lọc.");
            await state.window.webContents.executeJavaScript(
              "document.querySelector('[data-status-tab=all]').click();true",
            );
            await new Promise((resolve) => setTimeout(resolve, 180));
            await state.window.webContents.executeJavaScript(
              "document.querySelector('#selectAll').click();document.querySelector('[data-action=csv]').click();true",
            );
            await new Promise((resolve) => setTimeout(resolve, 350));
            const csvFiles = fs
              .readdirSync(path.join(base, "data", "exports"))
              .filter((name) => name.endsWith(".csv"));
            if (
              !csvFiles.length ||
              !fs
                .readFileSync(
                  path.join(base, "data", "exports", csvFiles.at(-1)),
                  "utf8",
                )
                .includes(scenario.invoice)
            )
              throw Error("Chọn hàng và xuất CSV hóa đơn không hoạt động.");
            await state.window.webContents.executeJavaScript(
              "document.querySelector('tr.clickable-row td:nth-child(3)').click();true",
            );
            await new Promise((resolve) => setTimeout(resolve, 180));
            const detail = await state.window.webContents.executeJavaScript(
              "document.querySelector('#modal-root')?.textContent || ''",
            );
            if (!detail.includes(scenario.invoice))
              throw Error("Bấm hàng hóa đơn không mở chi tiết.");
            await capture(state.window, path.join(base, "invoiceDetail.png"));
            await state.window.webContents.executeJavaScript(
              "document.querySelector('#modal-root [data-close]').click();true",
            );
          }
          if (route === "debts") {
            await state.window.webContents.executeJavaScript(
              "document.querySelector('[data-view=customers]').click();true",
            );
            await new Promise((resolve) => setTimeout(resolve, 250));
            await state.window.webContents.executeJavaScript(
              "document.querySelector('[data-client]').click();true",
            );
            await new Promise((resolve) => setTimeout(resolve, 250));
            const debtProfile =
              await state.window.webContents.executeJavaScript(
                "({drawer:!!document.querySelector('.debt-drawer'),total:document.querySelector('.debt-profile-total')?.textContent,invoice:document.querySelector('.debt-profile-invoice')?.textContent})",
              );
            if (
              !debtProfile.drawer ||
              !debtProfile.total?.includes("6.500.000") ||
              !debtProfile.invoice?.includes(scenario.invoice)
            )
              throw Error(
                `Hồ sơ công nợ chưa hiển thị đúng: ${JSON.stringify(debtProfile)}`,
              );
            await capture(state.window, path.join(base, "debtProfile.png"));
            await state.window.webContents.executeJavaScript(
              "document.querySelector('#modal-root [data-close]').click();true",
            );
            await state.window.webContents.executeJavaScript(
              "document.querySelector('[data-action^=\"bulk:\"]').click();true",
            );
            const bulkOpen = await state.window.webContents.executeJavaScript(
              "(async()=>{for(let i=0;i<40;i++){if(document.querySelector('#bulkForm'))return true;await new Promise(resolve=>setTimeout(resolve,100));}return false})()",
            );
            if (!bulkOpen) throw Error("Hộp thu gộp không mở.");
            state.window.showInactive();
            await new Promise((resolve) => setTimeout(resolve, 300));
            await capture(state.window, path.join(base, "bulkPayment.png"));
            state.window.hide();
            const manualUi = await state.window.webContents.executeJavaScript(
              "(()=>{document.querySelector('[data-strategy=manual]').click();const input=document.querySelector('#bulkRows [data-allocation]');input.value='1000';input.dispatchEvent(new Event('input',{bubbles:true}));const total=document.querySelector('#bulkAmount');total.value='1000';total.dispatchEvent(new Event('input',{bubbles:true}));return {selected:document.querySelector('[data-strategy=manual]').classList.contains('active'),min:input.min,amount:input.value,result:document.querySelector('#bulkResult').textContent}})()",
            );
            if (
              !manualUi.selected ||
              manualUi.min !== "0" ||
              manualUi.amount !== "1000" ||
              manualUi.result.includes("Chênh lệch")
            )
              throw Error(
                `Phân bổ thủ công trên UI chưa hoạt động: ${JSON.stringify(manualUi)}`,
              );
            await state.window.webContents.executeJavaScript(
              "document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));true",
            );
            await smokeInteractions.answer(state.window.webContents, false);
            if (!(await state.window.webContents.executeJavaScript("!!document.querySelector('#bulkForm')")))
              throw Error("Hủy cảnh báo đã đóng form thu gộp đang nhập dở.");
            await state.window.webContents.executeJavaScript(
              "document.querySelector('#bulkForm').requestSubmit();true",
            );
            await smokeInteractions.answer(state.window.webContents);
            await new Promise((resolve) => setTimeout(resolve, 450));
            const manualSaved =
              await state.window.webContents.executeJavaScript(
                `(async()=>({open:!!document.querySelector('#bulkForm'),payments:await window.invoiceApi['payments.list']({invoiceId:'${scenario.invoice}'})}))()`,
              );
            if (
              manualSaved.open ||
              manualSaved.payments.length !== 2 ||
              !manualSaved.payments.some((row) => row.amount === 1000)
            )
              throw Error(
                `Lưu thu gộp thủ công thất bại: ${JSON.stringify(manualSaved)}`,
              );
          }
          if (route === "customers") {
            const customerUi = await state.window.webContents.executeJavaScript(
              "({cards:document.querySelectorAll('.customer-kpi').length,tabs:document.querySelectorAll('[data-customer-tab]').length,regions:document.querySelector('#customerRegion')?.options.length})",
            );
            if (
              customerUi.cards !== 4 ||
              customerUi.tabs !== 3 ||
              !customerUi.regions
            )
              throw Error(
                `Màn hình khách hàng thiếu tổng quan hoặc bộ lọc: ${JSON.stringify(customerUi)}`,
              );
            await state.window.webContents.executeJavaScript(
              "document.querySelector('[data-customer-tab=debt]').click();true",
            );
            await new Promise((resolve) => setTimeout(resolve, 180));
            const debtTab = await state.window.webContents.executeJavaScript(
              "document.querySelector('[data-customer-tab=debt]')?.classList.contains('active')",
            );
            if (!debtTab)
              throw Error("Tab khách hàng đang nợ không giữ bộ lọc.");
            await state.window.webContents.executeJavaScript(
              "document.querySelector('[data-profile]').click();true",
            );
            await new Promise((resolve) => setTimeout(resolve, 300));
            await capture(state.window, path.join(base, "customerProfile.png"));
          }
          if (route === "payments") {
            const paymentUi = await state.window.webContents.executeJavaScript(
              "({cards:document.querySelectorAll('.payment-kpi').length,tabs:document.querySelectorAll('[data-method-tab]').length,month:document.querySelector('#paymentMonth')?.value,rows:document.querySelectorAll('.payment-table tbody tr').length})",
            );
            if (
              paymentUi.cards !== 4 ||
              paymentUi.tabs !== 4 ||
              paymentUi.month !==
                new Date().toLocaleDateString("en-CA").slice(0, 7) ||
              !paymentUi.rows
            )
              throw Error(
                `Màn hình phiếu thu thiếu bộ lọc hoặc thẻ tổng quan: ${JSON.stringify(paymentUi)}`,
              );
            await state.window.webContents.executeJavaScript(
              "document.querySelector('[data-method-tab=cash]').click();true",
            );
            await new Promise((resolve) => setTimeout(resolve, 180));
            const cashTab = await state.window.webContents.executeJavaScript(
              "document.querySelector('[data-method-tab=cash]')?.classList.contains('active')",
            );
            if (!cashTab) throw Error("Tab tiền mặt không giữ bộ lọc.");
            await state.window.webContents.executeJavaScript(
              "document.querySelector('[data-method-tab=all]').click();true",
            );
            await new Promise((resolve) => setTimeout(resolve, 650));
            await state.window.webContents.executeJavaScript(
              "document.querySelector('[data-action=create]').click();true",
            );
            const paymentOpen =
              await state.window.webContents.executeJavaScript(
                "(async()=>{for(let i=0;i<40;i++){if(document.querySelector('#paymentForm'))return true;await new Promise(resolve=>setTimeout(resolve,100));}return false})()",
              );
            if (!paymentOpen) throw Error("Hộp lập phiếu thu không mở.");
            const paymentDialogUi =
              await state.window.webContents.executeJavaScript(
                "({modes:document.querySelectorAll('#paymentForm [data-mode]').length,min:document.querySelector('#paymentAmount')?.min,max:document.querySelector('#paymentAmount')?.max,amount:document.querySelector('#paymentAmount')?.value})",
              );
            if (
              paymentDialogUi.modes !== 2 ||
              paymentDialogUi.min !== "0" ||
              Number(paymentDialogUi.amount) > Number(paymentDialogUi.max)
            )
              throw Error(
                `Hộp thu tiền thiếu phương án hoặc kiểm tra số: ${JSON.stringify(paymentDialogUi)}`,
              );
            await new Promise((resolve) => setTimeout(resolve, 300));
            const paymentVisible =
              await state.window.webContents.executeJavaScript(
                "(()=>{const overlay=document.querySelector('#modal-root .overlay');return {form:!!document.querySelector('#paymentForm'),overlay:!!overlay,display:getComputedStyle(overlay).display,visibility:getComputedStyle(overlay).visibility,opacity:getComputedStyle(overlay).opacity,z:getComputedStyle(overlay).zIndex,top:document.elementFromPoint(innerWidth/2,innerHeight/2)?.outerHTML.slice(0,120),rect:overlay?.getBoundingClientRect().toJSON()}})()",
              );
            if (
              !paymentVisible.form ||
              !paymentVisible.overlay ||
              !paymentVisible.rect.width
            )
              throw Error(
                `Hộp thu tiền biến mất trước khi chụp: ${JSON.stringify(paymentVisible)}`,
              );
            console.log(
              `Payment dialog visibility: ${JSON.stringify(paymentVisible)}`,
            );
            state.window.showInactive();
            await new Promise((resolve) => setTimeout(resolve, 350));
            await capture(state.window, path.join(base, "paymentDialog.png"));
            state.window.hide();
            const partial = await state.window.webContents.executeJavaScript(
              "(()=>{document.querySelector('#paymentForm [data-action=pct25]').click();const amount=document.querySelector('#paymentAmount');return {active:document.querySelector('[data-mode=partial]').classList.contains('active'),readonly:amount.readOnly,amount:Number(amount.value),max:Number(amount.max),remaining:document.querySelector('#paymentResult').textContent}})()",
            );
            if (
              !partial.active ||
              partial.readonly ||
              partial.amount <= 0 ||
              partial.amount >= partial.max ||
              !partial.remaining.includes("còn nợ")
            )
              throw Error(
                `Hộp thu một phần không hoạt động: ${JSON.stringify(partial)}`,
              );
            state.window.showInactive();
            await new Promise((resolve) => setTimeout(resolve, 300));
            await capture(state.window, path.join(base, "paymentPartial.png"));
            const paymentBottom =
              await state.window.webContents.executeJavaScript(
                "(()=>{const modal=document.querySelector('.modal.payment-dialog');modal.scrollTop=modal.scrollHeight;const bottom=modal.getBoundingClientRect().bottom;const submit=document.querySelector('#paymentSubmit').getBoundingClientRect();return {scrollTop:modal.scrollTop,scrollHeight:modal.scrollHeight,clientHeight:modal.clientHeight,submitVisible:submit.top>=modal.getBoundingClientRect().top&&submit.bottom<=bottom}})()",
              );
            if (
              paymentBottom.scrollHeight > paymentBottom.clientHeight &&
              (!paymentBottom.scrollTop || !paymentBottom.submitVisible)
            )
              throw Error(
                `Không cuộn được đến nút lưu phiếu thu: ${JSON.stringify(paymentBottom)}`,
              );
            await capture(
              state.window,
              path.join(base, "paymentPartialBottom.png"),
            );
            state.window.hide();
            await state.window.webContents.executeJavaScript(
              "document.querySelector('#modal-root [data-close]')?.click();true",
            );
            await smokeInteractions.answer(state.window.webContents);
            await smokeReceipt.exercise(state);
          }
}
module.exports = { exercise };
