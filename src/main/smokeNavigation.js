"use strict";
const customers = require("./services/customers");

async function heading(web, expected) {
  const found = await web.executeJavaScript(`(async()=>{
    for(let i=0;i<80;i++){
      if(document.querySelector('#page h1')?.textContent===${JSON.stringify(expected)})return true;
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    return false;
  })()`);
  if (!found) throw Error(`Không mở được trang ${expected}.`);
}
async function checkReady(state) {
  for (let i = 0; i < 80 && !state.uiReady; i++)
    await new Promise((resolve) => setTimeout(resolve, 50));
  if (!state.uiReady) throw Error("Renderer chưa báo giao diện đầu tiên sẵn sàng.");
  const initial = await state.window.webContents.executeJavaScript(
    "({heading:document.querySelector('#page h1')?.textContent, loading:document.querySelector('#app')?.textContent.includes('Đang tải dữ liệu')})",
  );
  if (initial.heading !== "Tổng quan" || initial.loading)
    throw Error(`Giao diện đầu tiên chưa hoàn tất: ${JSON.stringify(initial)}`);
}
async function exercise(state) {
  const web = state.window.webContents;
  await web.executeJavaScript("document.querySelector('[data-route=dashboard]').click();true");
  await heading(web, "Tổng quan");
  await web.executeJavaScript(`(()=>{
    const app=document.querySelector('#app');
    window.__navProbe={sidebar:document.querySelector('.sidebar'),page:document.querySelector('#page'),
      replaced:0,loading:0};
    const observer=new MutationObserver(records=>{
      for(const record of records){
        if(record.target===app)window.__navProbe.replaced++;
        if([...record.addedNodes].some(node=>node.textContent?.includes('Đang tải dữ liệu')))
          window.__navProbe.loading++;
      }
    });
    observer.observe(app,{childList:true,subtree:true});
    window.__navProbe.observer=observer;
    return true;
  })()`);
  const original = customers.list;
  try {
    customers.list = async (...args) => {
      await new Promise((resolve) => setTimeout(resolve, 260));
      return original(...args);
    };
    const immediate = await web.executeJavaScript(`(()=>{
      document.querySelector('[data-route=customers]').click();
      return document.querySelector('#page h1')?.textContent;
    })()`);
    if (immediate !== "Tổng quan")
      throw Error(`Trang cũ biến mất trước khi trang mới sẵn sàng: ${immediate}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const waiting = await web.executeJavaScript("document.querySelector('#page h1')?.textContent");
    if (waiting !== "Tổng quan")
      throw Error(`Trang cũ bị thay bằng màn tải: ${waiting}`);
    await heading(web, "Khách hàng");
    const result = await web.executeJavaScript(`({
      sidebar:document.querySelector('.sidebar')===window.__navProbe.sidebar,
      page:document.querySelector('#page')!==window.__navProbe.page &&
        !window.__navProbe.page.isConnected,
      replaced:window.__navProbe.replaced,
      loading:window.__navProbe.loading,
      active:document.querySelector('.nav-item.active')?.dataset.route
    })`);
    if (!result.sidebar || !result.page || result.replaced || result.loading || result.active !== "customers")
      throw Error(`Chuyển trang vẫn nhấp nháy: ${JSON.stringify(result)}`);
    console.log("Navigation: shell and prior page remain until the next page is ready.");
  } finally {
    customers.list = original;
    await web.executeJavaScript("window.__navProbe?.observer?.disconnect();delete window.__navProbe;true").catch(() => {});
  }
}
module.exports = { checkReady, exercise };
