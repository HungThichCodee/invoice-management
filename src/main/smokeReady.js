'use strict';
const fs = require('node:fs');
async function waitForPage(contents) {
  const ready = await contents.executeJavaScript(`(async () => {
    for (let i = 0; i < 80; i++) {
      const page = document.querySelector('#page');
      if (page?.querySelector('h1') && !page.textContent.includes('Đang tải dữ liệu')) return true;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return false;
  })()`);
  if (!ready) throw Error('Trang chưa tải xong trong smoke test.');
}
module.exports = { waitForPage };
async function capture(window, file) {
  window.showInactive();
  await waitForPage(window.webContents);
  await new Promise(resolve => setTimeout(resolve, 300));
  fs.writeFileSync(file, (await window.webContents.capturePage()).toPNG());
  window.hide();
}
module.exports.capture = capture;
async function captureAtBottom(window, file) {
  const amount = await window.webContents.executeJavaScript("(()=>{const page=document.scrollingElement;page.scrollTo(0,page.scrollHeight);return {top:page.scrollTop,height:page.scrollHeight,view:page.clientHeight}})()");
  if (amount.height > amount.view && amount.top === 0) throw Error(`Không cuộn được đến cuối trang: ${JSON.stringify(amount)}`);
  await capture(window, file);
  await window.webContents.executeJavaScript("document.scrollingElement.scrollTo(0,0);true");
}
module.exports.captureAtBottom = captureAtBottom;
async function captureFullPage(window, file) {
  window.showInactive();
  await waitForPage(window.webContents);
  await window.webContents.executeJavaScript("document.scrollingElement.scrollTo(0,0);true");
  const debuggerApi = window.webContents.debugger;
  debuggerApi.attach('1.3');
  try {
    const metrics = await debuggerApi.sendCommand('Page.getLayoutMetrics');
    const size = metrics.cssContentSize || metrics.contentSize;
    const result = await debuggerApi.sendCommand('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: size.width, height: size.height, scale: 1 }
    });
    fs.writeFileSync(file, Buffer.from(result.data, 'base64'));
    return { width: size.width, height: size.height };
  } finally {
    debuggerApi.detach();
    window.hide();
  }
}
module.exports.captureFullPage = captureFullPage;
async function captureDesign(window, file, width, height) {
  const previous = window.getContentSize();
  window.showInactive();
  try {
    window.setContentSize(width, previous[1]);
    await waitForPage(window.webContents);
    await new Promise(resolve => setTimeout(resolve, 250));
    const viewport = await window.webContents.executeJavaScript('({width:innerWidth,dpr:devicePixelRatio})');
    if (Math.abs(viewport.width - width) > 2) throw Error(`Viewport thiết kế ${viewport.width}px, cần ${width}px.`);
    const debuggerApi = window.webContents.debugger;
    debuggerApi.attach('1.3');
    try {
      const result = await debuggerApi.sendCommand('Page.captureScreenshot', {
        format: 'png', captureBeyondViewport: true,
        clip: { x: 0, y: 0, width, height, scale: 1 / viewport.dpr }
      });
      fs.writeFileSync(file, Buffer.from(result.data, 'base64'));
    } finally { debuggerApi.detach(); }
  } finally {
    window.setContentSize(...previous);
    window.hide();
  }
}
module.exports.captureDesign = captureDesign;
