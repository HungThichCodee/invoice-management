"use strict";
const path = require("node:path");
const { waitForPage, capture, captureFullPage, captureDesign } = require("./smokeReady");
const smokeImport = require("./smokeImport");
const smokeReports = require("./smokeReports");
const smokeFinancePages = require("./smokeFinancePages");
const smokeInteractions = require("./smokeInteractions");
async function exercise(state, base, scenario) {
        const headings = [];
        for (const route of [
          "dashboard",
          "activity",
          "invoices",
          "debts",
          "customers",
          "payments",
          "reports",
          "imports",
          "backups",
          "settings",
          "invoiceForm",
        ]) {
          if (route === "imports") await smokeImport.prepare(state, base);
          if (route === "activity") {
            await state.window.webContents.executeJavaScript(
              "document.querySelector('[data-action=activity]').click(); true",
            );
          } else {
            const linkReady = await state.window.webContents.executeJavaScript(
              `(async()=>{for(let i=0;i<40;i++){const link=document.querySelector('[data-route=${route}]');if(link){link.click();return true;}await new Promise(resolve=>setTimeout(resolve,100));}return false})()`,
            );
            if (!linkReady) throw Error(`Không tìm thấy điều hướng ${route}.`);
            if (route === "invoiceForm")
              await smokeInteractions.answer(state.window.webContents);
          }
          await new Promise((resolve) => setTimeout(resolve, 800));
          await waitForPage(state.window.webContents);
          if (route === "invoiceForm") {
            const picked = await state.window.webContents.executeJavaScript(
              "(()=>{const input=document.querySelector('[name=customerId]');input.value=input.querySelector('option:not([value=\"\"])').value;input.dispatchEvent(new Event('change',{bubbles:true}));return {id:input.value,code:document.querySelector('[name=invoiceId]').value}})()",
            );
            await new Promise((resolve) => setTimeout(resolve, 300));
            const profile = await state.window.webContents.executeJavaScript(
              "document.querySelector('#clientDebt')?.textContent || ''",
            );
            if (
              !picked.id ||
              !/^HD-[0-9]+$/.test(picked.code) ||
              !profile.includes("6.499.000")
            )
              throw Error(
                `Thông tin khách trên hóa đơn chưa cập nhật: ${JSON.stringify({ picked, profile })}`,
              );
          }
          const title = await state.window.webContents.executeJavaScript(
            "document.querySelector('#page h1')?.textContent || document.querySelector('#page')?.textContent.slice(0,80)",
          );
          headings.push(`${route}: ${title}`);
          if (route !== "dashboard")
            await capture(state.window, path.join(base, `route-${route}.png`));
          if (route !== "dashboard" && route !== "reports")
            await captureFullPage(
              state.window,
              path.join(base, `full-${route}.png`),
            );
          if (route === "backups") {
            const backupUi = await state.window.webContents.executeJavaScript(
              "({restore:document.querySelectorAll('[data-action^=\"restoreNamed:\"]').length,copy:document.querySelectorAll('[data-action^=\"copy:\"]').length,min:document.querySelector('#keep')?.min})",
            );
            if (
              !backupUi.restore ||
              backupUi.restore !== backupUi.copy ||
              backupUi.min !== "0"
            )
              throw Error(
                `Lịch sử sao lưu thiếu thao tác khôi phục: ${JSON.stringify(backupUi)}`,
              );
          }
          if (route === "imports") await smokeImport.exercise(state, base);
          await smokeFinancePages.exercise(route, state, base, scenario);
          if (route === "reports") {
            await smokeReports.exercise(state, base);
          }
          if (route === "settings") {
            await captureDesign(
              state.window,
              path.join(base, "design-settings.png"),
              1053,
              1600,
            );
            const numbering = await state.window.webContents.executeJavaScript(
              "(()=>{const form=document.querySelector('#settingsForm');form.elements.invoicePrefix.value='XN-';form.elements.invoiceCounter.value='5';form.elements.invoiceCounter.dispatchEvent(new Event('input',{bubbles:true}));return {next:document.querySelector('#invoiceNext')?.textContent,min:form.elements.invoiceCounter.min,receiptMin:form.elements.paymentCounter.min,logo:!!document.querySelector('.settings-logo-image')}})()",
            );
            if (
              numbering.next !== "XN-000006" ||
              numbering.min !== "0" ||
              numbering.receiptMin !== "0" ||
              !numbering.logo
            )
              throw Error(
                `Cài đặt mã chứng từ trên UI chưa hoạt động: ${JSON.stringify(numbering)}`,
              );
            const fontUi = await state.window.webContents.executeJavaScript(
              "(()=>{const select=document.querySelector('[name=fontSize]');return {options:select?.options.length,value:select?.value}})()",
            );
            if (fontUi.options !== 3 || fontUi.value !== "14")
              throw Error(
                `Cài đặt cỡ chữ chưa hiển thị: ${JSON.stringify(fontUi)}`,
              );
            await state.window.webContents.executeJavaScript(
              "document.body.classList.add('dark');true",
            );
            state.window.showInactive();
            await new Promise((resolve) => setTimeout(resolve, 250));
            await capture(state.window, path.join(base, "settingsDark.png"));
            state.window.hide();
            await state.window.webContents.executeJavaScript(
              "document.body.classList.remove('dark');true",
            );
          }
        }
  return headings;
}
module.exports = { exercise };
