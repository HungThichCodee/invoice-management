'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { waitForPage } = require('./smokeReady');

async function exercise(state, base) {
  const window = state.window;
  const web = window.webContents;
  const previous = window.getContentSize();
  window.showInactive();
  window.setContentSize(390, 844);
  await web.executeJavaScript("document.getElementById('toast-root').innerHTML='';true");
  try {
    const routes = ['dashboard', 'activity', 'invoices', 'debts', 'customers',
      'customerProfile', 'payments', 'reports', 'reportDetail', 'imports',
      'backups', 'settings', 'invoiceForm'];
    for (const route of routes) {
      if (route === 'activity')
        await web.executeJavaScript("document.querySelector('[data-action=activity]').click();true");
      else if (route === 'customerProfile')
        await web.executeJavaScript("document.querySelector('[data-profile]').click();true");
      else if (route === 'reportDetail')
        await web.executeJavaScript("document.querySelector('[data-period]').click();true");
      else await web.executeJavaScript(`document.querySelector('[data-route=${route}]').click();true`);
      await new Promise(resolve => setTimeout(resolve, 260));
      await waitForPage(web);
      const size = await web.executeJavaScript(`({width:innerWidth,
        page:document.documentElement.scrollWidth,
        content:document.querySelector('#page')?.scrollWidth,
        heading:document.querySelector('#page h1')?.textContent,
        overflow:[...document.querySelectorAll('#page *')].filter(node=>node.getBoundingClientRect().right>innerWidth+2)
          .slice(0,5).map(node=>({tag:node.tagName,class:node.className,right:Math.round(node.getBoundingClientRect().right)}))})`);
      if (!size.heading || Math.abs(size.width - 390) > 2 || size.page > size.width + 2)
        throw Error(`Giao diện mobile tràn ngang ở ${route}: ${JSON.stringify(size)}`);
      fs.writeFileSync(path.join(base, `mobile-${route}.png`), (await web.capturePage()).toPNG());
    }
    await web.executeJavaScript("document.querySelector('[data-route=debts]').click();true");
    await new Promise(resolve => setTimeout(resolve, 260));
    await web.executeJavaScript("document.querySelector('[data-view=customers]').click();true");
    await new Promise(resolve => setTimeout(resolve, 260));
    await web.executeJavaScript("document.querySelector('[data-client]').click();true");
    await new Promise(resolve => setTimeout(resolve, 260));
    const drawer = await web.executeJavaScript("({open:!!document.querySelector('.debt-drawer'),width:innerWidth,page:document.documentElement.scrollWidth})");
    if (!drawer.open || drawer.page > drawer.width + 2)
      throw Error(`Hồ sơ công nợ mobile bị tràn: ${JSON.stringify(drawer)}`);
    fs.writeFileSync(path.join(base, 'mobile-debtProfile.png'), (await web.capturePage()).toPNG());
    await web.executeJavaScript("document.querySelector('#modal-root [data-close]').click();true");
    await web.executeJavaScript("document.querySelector('[data-action^=\"bulk:\"]').click();true");
    await new Promise(resolve => setTimeout(resolve, 350));
    const bulk = await web.executeJavaScript("({open:!!document.querySelector('#bulkForm'),width:innerWidth,page:document.documentElement.scrollWidth})");
    if (!bulk.open || bulk.page > bulk.width + 2)
      throw Error(`Hộp thu gộp mobile bị tràn: ${JSON.stringify(bulk)}`);
    fs.writeFileSync(path.join(base, 'mobile-bulkDialog.png'), (await web.capturePage()).toPNG());
    await web.executeJavaScript("document.querySelector('#modal-root [data-close]').click();true");
    await web.executeJavaScript("document.querySelector('[data-route=payments]').click();true");
    await new Promise(resolve => setTimeout(resolve, 260));
    await web.executeJavaScript("document.querySelector('[data-action=create]').click();true");
    await new Promise(resolve => setTimeout(resolve, 350));
    const payment = await web.executeJavaScript("({open:!!document.querySelector('#paymentForm'),width:innerWidth,page:document.documentElement.scrollWidth})");
    if (!payment.open || payment.page > payment.width + 2)
      throw Error(`Hộp phiếu thu mobile bị tràn: ${JSON.stringify(payment)}`);
    fs.writeFileSync(path.join(base, 'mobile-paymentDialog.png'), (await web.capturePage()).toPNG());
    await web.executeJavaScript("document.querySelector('#modal-root [data-close]').click();true");
    await web.executeJavaScript("document.querySelector('[data-route=reports]').click();true");
    await new Promise(resolve => setTimeout(resolve, 260));
    await web.executeJavaScript("document.querySelector('[data-action=year]').click();true");
    await new Promise(resolve => setTimeout(resolve, 260));
    const year = await web.executeJavaScript("({width:innerWidth,page:document.documentElement.scrollWidth,title:document.querySelector('#page h1')?.textContent})");
    if (!year.title || year.page > year.width + 2)
      throw Error(`Báo cáo năm mobile bị tràn: ${JSON.stringify(year)}`);
    fs.writeFileSync(path.join(base, 'mobile-reportsYear.png'), (await web.capturePage()).toPNG());
    console.log(`Mobile responsive: ${routes.length} screens at 390px, no page overflow.`);
  } finally { window.setContentSize(...previous); window.hide(); }
}
module.exports = { exercise };
