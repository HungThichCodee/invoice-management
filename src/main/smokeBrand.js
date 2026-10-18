"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { dialog } = require("electron");
const { answer } = require("./smokeInteractions");
const { waitForPage } = require("./smokeReady");

async function inspect(web) {
  return web.executeJavaScript(`({
    name: document.querySelector('.brand-title')?.textContent,
    top: document.querySelector('.topbar-title')?.textContent,
    title: document.title,
    logo: document.querySelector('.brand-logo img')?.src || ''
  })`);
}
async function waitFor(web, selector) {
  const found = await web.executeJavaScript(`(async()=>{
    for(let i=0;i<60;i++){
      if(document.querySelector(${JSON.stringify(selector)}))return true;
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    return false;
  })()`);
  if (!found) throw Error(`Không mở được màn hình ${selector}.`);
}
async function exercise(state, base) {
  const web = state.window.webContents;
  await web.executeJavaScript("document.querySelector('[data-route=settings]').click();true");
  await waitFor(web, "#settingsForm");
  const original = await inspect(web);
  const name = "Công ty kiểm thử thương hiệu";
  await web.executeJavaScript(`(()=>{
    const field=document.querySelector('#settingsForm [name=sellerName]');
    field.value=${JSON.stringify(name)};
    field.dispatchEvent(new Event('input',{bubbles:true}));
    return true;
  })()`);
  if ((await inspect(web)).name !== original.name)
    throw Error("Tên chưa lưu đã đổi trên thanh ứng dụng.");
  await web.executeJavaScript("document.querySelector('[data-action=save]').click();true");
  await answer(web);
  let current = await inspect(web);
  if (current.name !== name || current.top !== name || !current.title.includes(name))
    throw Error(`Lưu tên chưa cập nhật thanh ứng dụng: ${JSON.stringify(current)}`);
  if (state.window.getTitle() !== current.title)
    throw Error("Tên trên thanh tiêu đề cửa sổ chưa đồng bộ.");

  const source = path.join(base, "dashboard.png");
  if (!fs.existsSync(source) || fs.statSync(source).size > 5 * 1024 * 1024)
    throw Error("Thiếu ảnh PNG nhỏ để thử đổi logo.");
  const originalDialog = dialog.showOpenDialog;
  try {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [source] });
    await web.executeJavaScript("document.querySelector('[data-action=logo]').click();true");
    await answer(web);
    await waitFor(web, ".brand-logo img");
  } finally {
    dialog.showOpenDialog = originalDialog;
  }
  current = await inspect(web);
  if (current.name !== name || !current.logo.startsWith("data:image/png;base64,"))
    throw Error(`Đổi logo chưa cập nhật thanh ứng dụng: ${JSON.stringify(current)}`);
  await web.executeJavaScript("document.querySelector('[data-route=dashboard]').click();true");
  await waitFor(web, "#monthToggle");
  await new Promise((resolve) => { web.once("did-finish-load", resolve); web.reload(); });
  await waitForPage(web);
  current = await inspect(web);
  if (current.name !== name || !current.logo.startsWith("data:image/png;base64,"))
    throw Error(`Thương hiệu không giữ sau tải lại: ${JSON.stringify(current)}`);
  await web.executeJavaScript("document.querySelector('[data-route=settings]').click();true");
  await waitFor(web, "#settingsForm");
  await web.executeJavaScript("document.querySelector('[data-action=removeLogo]').click();true");
  await answer(web);
  current = await inspect(web);
  if (current.name !== name || current.logo)
    throw Error(`Xóa logo chưa cập nhật thanh ứng dụng: ${JSON.stringify(current)}`);
  console.log("Branding: name and logo update immediately and persist after reload.");
}
module.exports = { exercise };
