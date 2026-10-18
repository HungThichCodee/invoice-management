"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { waitForPage, capture, captureFullPage } = require("./smokeReady");
async function exercise(state, base) {
        await new Promise((resolve) => setTimeout(resolve, 1800));
        const scenario = await state.window.webContents
          .executeJavaScript(`(async () => {
      const api=window.invoiceApi, date=new Date().toLocaleDateString('en-CA');
      const c=await api['customers.create']({name:'Công ty Minh Phát kiểm thử',phone:'0901234567'});
      const i=await api['invoices.create']({customerId:c.id,date,due:date,items:[{name:'Thuê xe nâng',qty:1,price:13500000,capacity:3000}]});
      await api['payments.create']({invoiceId:i.id,date,amount:7000000,method:'bank'});
      await api['settings.update']({darkMode:'false'});
      const activities=await api['reports.activity'](1);
      if(activities.total!==3)throw Error('Nhật ký hoạt động đang lẫn thay đổi cài đặt.');
      let negative=''; try { await api['payments.create']({invoiceId:i.id,date,amount:-1}); } catch(e) { negative=e.message; }
      const pdf=await api['exports.pdf']({kind:'invoice',filter:{id:i.id}});
      const excel=await api['exports.excel']({});
      const monthlyPdf=await api['exports.pdf']({kind:'report',filter:{month:date.slice(0,7)}});
      const monthlyExcel=await api['exports.excel']({reportMonth:date.slice(0,7)});
      await api['backups.create']();
      return {invoice:i.id,negative,pdf,excel,monthlyPdf,monthlyExcel};
    })()`);
        console.log(`Scenario: ${JSON.stringify(scenario)}`);
        await state.window.webContents.executeJavaScript(
          "document.querySelector('[data-route=dashboard]').click(); true",
        );
        await new Promise((resolve) => setTimeout(resolve, 900));
        const dashboardCheck = await state.window.webContents
          .executeJavaScript(`(async()=>({
      month:document.querySelector('#monthToggle')?.textContent,
      metrics:document.querySelector('.dashboard-metrics')?.textContent,
      activity:document.querySelector('.activity-card')?.textContent,
      direct:(await window.invoiceApi['reports.dashboard']('${new Date().toLocaleDateString("en-CA")}')).revenue
    }))()`);
        console.log(`Dashboard: ${JSON.stringify(dashboardCheck)}`);
        if (
          !dashboardCheck.metrics?.includes("13.500.000") ||
          !dashboardCheck.activity?.includes("Đã ghi phiếu thu")
        )
          throw Error("Dashboard không hiển thị dữ liệu mới.");
        const contrast = await state.window.webContents
          .executeJavaScript(`(() => {
      const selectors='.metric-bottom span,.chart-axis span,.chart-note,.due-main .muted,.linked-row .muted,.activity .muted,.subtitle,.side-label,.nav-item,.sidebar-foot,.topbar-title';
      const rgb=value=>(value.match(/[\\d.]+/g)||[]).slice(0,3).map(Number);
      const luminance=value=>rgb(value).map(n=>{const x=n/255;return x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4;}).reduce((n,x,i)=>n+x*[0.2126,0.7152,0.0722][i],0);
      const background=node=>{for(let item=node;item;item=item.parentElement){const value=getComputedStyle(item).backgroundColor;if(value&&!value.endsWith(', 0)'))return value;}return 'rgb(255, 255, 255)';};
      const rows=[...document.querySelectorAll(selectors)].filter(node=>node.textContent.trim()).map(node=>{
        const foreground=luminance(getComputedStyle(node).color),back=luminance(background(node));
        return {label:node.textContent.trim().slice(0,30),ratio:Math.round((Math.max(foreground,back)+0.05)/(Math.min(foreground,back)+0.05)*100)/100};
      });
      return {checked:rows.length,minimum:Math.min(...rows.map(row=>row.ratio)),failures:rows.filter(row=>row.ratio<4.5)};
    })()`);
        if (!contrast.checked || contrast.failures.length)
          throw Error(
            `Tương phản chữ phụ dưới 4,5:1: ${JSON.stringify(contrast)}`,
          );
        console.log(`Secondary text contrast: ${JSON.stringify(contrast)}`);
        const picker = await state.window.webContents
          .executeJavaScript(`(() => {
      document.querySelector('#monthToggle').click();
      const panel=document.querySelector('#monthPopover');
      return {visible:!panel.classList.contains('hidden'),months:panel.querySelectorAll('[data-month]').length,label:document.querySelector('#monthToggle').textContent};
    })()`);
        if (
          !picker.visible ||
          picker.months !== 12 ||
          !picker.label.includes(
            `Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`,
          )
        )
          throw Error("Bộ chọn tháng tiếng Việt không hoạt động.");
        await state.window.webContents.executeJavaScript(
          "document.querySelector('#monthToggle').click();true",
        );
        const suggestions = await state.window.webContents
          .executeJavaScript(`(async()=>{
      const input=document.querySelector('#globalSearch');input.value='Minh Phát';
      input.dispatchEvent(new Event('input',{bubbles:true}));
      await new Promise(resolve=>setTimeout(resolve,350));
      return {text:document.querySelector('#searchSuggestions')?.textContent,visible:!document.querySelector('#searchSuggestions')?.classList.contains('hidden')};
    })()`);
        if (
          !suggestions.visible ||
          !suggestions.text.includes("Công ty Minh Phát")
        )
          throw Error("Gợi ý tìm kiếm khách hàng không hoạt động.");
        console.log(`Search suggestions: ${JSON.stringify(suggestions)}`);
        await state.window.webContents.executeJavaScript(
          "document.querySelector('#globalSearch').value='';document.querySelector('#globalSearch').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#searchSuggestions').classList.add('hidden');true",
        );
        for (const file of [
          scenario.pdf,
          scenario.excel,
          scenario.monthlyPdf,
          scenario.monthlyExcel,
        ]) {
          if (!fs.existsSync(file) || fs.statSync(file).size < 100)
            throw Error(`File xuất không hợp lệ: ${file}`);
        }
        await state.window.webContents.executeJavaScript(
          "document.querySelector('[data-route=dashboard]').click();true",
        );
        await new Promise((resolve) => setTimeout(resolve, 450));
        await waitForPage(state.window.webContents);
        await capture(state.window, path.join(base, "dashboard.png"));
        await captureFullPage(
          state.window,
          path.join(base, "full-dashboard.png"),
        );
        await state.window.webContents.executeJavaScript(
          "document.querySelector('#notificationsButton').click(); true",
        );
        await new Promise((resolve) => setTimeout(resolve, 250));
        const reminder = await state.window.webContents.executeJavaScript(
          "document.querySelector('#modal-root')?.textContent || ''",
        );
        if (!reminder.includes(scenario.invoice))
          throw Error("Nhắc nợ nội bộ không hiển thị hóa đơn.");
        await state.window.webContents.executeJavaScript(
          "document.querySelector('#modal-root [data-close]').click(); true",
        );
        await state.window.webContents.executeJavaScript(
          "document.querySelector('.due-main').click();true",
        );
        await new Promise((resolve) => setTimeout(resolve, 450));
        const dueDetail = await state.window.webContents.executeJavaScript(
          "document.querySelector('#modal-root')?.textContent || ''",
        );
        if (!dueDetail.includes(scenario.invoice))
          throw Error("Hóa đơn đến hạn không mở được chi tiết.");
        await state.window.webContents.executeJavaScript(
          "document.querySelector('#modal-root [data-close]').click();document.querySelector('[data-route=dashboard]').click();true",
        );
        await new Promise((resolve) => setTimeout(resolve, 450));
        await state.window.webContents.executeJavaScript(
          "document.querySelector('[data-metric=revenue]').click();true",
        );
        await new Promise((resolve) => setTimeout(resolve, 450));
        const revenueTitle = await state.window.webContents.executeJavaScript(
          "document.querySelector('#page h1')?.textContent || ''",
        );
        if (
          !revenueTitle.includes(
            `Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`,
          )
        )
          throw Error("KPI doanh thu không mở báo cáo đúng tháng.");
        await state.window.webContents.executeJavaScript(
          "document.querySelector('[data-route=dashboard]').click();true",
        );
        await new Promise((resolve) => setTimeout(resolve, 450));
        await state.window.webContents.executeJavaScript(
          "document.querySelector('[data-metric=cash]').click();true",
        );
        await new Promise((resolve) => setTimeout(resolve, 450));
        const cashFilter = await state.window.webContents.executeJavaScript(
          "document.querySelector('.payment-filters')?.textContent || ''",
        );
        if (!cashFilter.includes("Xóa lọc kỳ"))
          throw Error("KPI tiền thu không lọc phiếu thu theo tháng.");
        await state.window.webContents.executeJavaScript(
          "document.querySelector('[data-route=dashboard]').click();true",
        );
        await new Promise((resolve) => setTimeout(resolve, 450));
        await state.window.webContents.executeJavaScript(
          "document.querySelector('[data-metric=overdue]').click();true",
        );
        await new Promise((resolve) => setTimeout(resolve, 450));
        const debtFilter = await state.window.webContents.executeJavaScript(
          "document.querySelector('#filter')?.value || ''",
        );
        if (debtFilter !== "overdue")
          throw Error("KPI quá hạn không lọc công nợ.");
  return scenario;
}
module.exports = { exercise };
