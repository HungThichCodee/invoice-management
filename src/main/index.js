"use strict";
const { app, BrowserWindow, Menu, nativeImage, session } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { Store } = require("./db");
const backups = require("./services/backups");
const { register } = require("./ipc");
const { capture } = require("./smokeReady");
const smokeBackup = require("./smokeBackup");
const { installCloseGuard } = require("./closeGuard");
const smokeInteractions = require("./smokeInteractions");
const smokeResponsive = require("./smokeResponsive");
const smokeCloseGuard = require("./smokeCloseGuard");
const smokeBrand = require("./smokeBrand");
const smokeInitial = require("./smokeInitial");
const smokePages = require("./smokePages");

if (!app.requestSingleInstanceLock()) app.quit();
else
  app
    .whenReady()
    .then(async () => {
      if (process.platform === "win32")
        app.setAppUserModelId("vn.xenang.hoadon.offline");
      Menu.setApplicationMenu(null);
      const appIcon = nativeImage.createFromBuffer(
        fs.readFileSync(path.join(app.getAppPath(), "forklift.png")),
      );
      if (appIcon.isEmpty()) throw Error("Không đọc được biểu tượng forklift.png");
      const smoke = process.argv.includes("--smoke");
      const base = smoke
        ? path.join(app.getPath("temp"), `HoaDonXeNang-smoke-${process.pid}`)
        : path.join(
            process.env.LOCALAPPDATA || app.getPath("userData"),
            "HoaDonXeNang",
          );
      fs.mkdirSync(base, { recursive: true });
      const configFile = path.join(base, "config.json");
      let config = {};
      try {
        config = JSON.parse(fs.readFileSync(configFile, "utf8"));
      } catch {
        /* lần chạy đầu */
      }
      const state = {
        smoke,
        uiReady: false,
        configFile,
        importSession: null,
        log: (value) =>
          fs.appendFileSync(
            path.join(base, "app.log"),
            `${new Date().toISOString()} ${value}\n`,
          ),
      };
      state.store = new Store(config.dataFolder || path.join(base, "data"));
      session.defaultSession.webRequest.onBeforeRequest(
        { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] },
        (_request, callback) => callback({ cancel: true }),
      );
      app.on("web-contents-created", (_event, contents) => {
        contents.setWindowOpenHandler(() => ({ action: "deny" }));
        contents.on("will-navigate", (event) => event.preventDefault());
      });
      state.window = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 360,
        minHeight: 500,
        show: false,
        icon: appIcon,
        autoHideMenuBar: true,
        title: "Hóa đơn Xe nâng",
        backgroundColor: "#f5f8ff",
        webPreferences: {
          preload: path.join(__dirname, "../preload/index.js"),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          backgroundThrottling: false,
        },
      });
      if (!smoke) installCloseGuard(state.window, state.log);
      register(state);
      state.window.webContents.on("did-finish-load", () => {
        state.importSession = null;
      });
      state.window.webContents.on(
        "console-message",
        (_event, level, message, line, source) =>
          state.log(`renderer ${level} ${source}:${line}: ${message}`),
      );
      await state.window.loadFile(
        path.join(__dirname, "../renderer/index.html"),
      );
      setTimeout(() => {
        if (!state.smoke && !state.uiReady && !state.window.isDestroyed()) {
          state.log("Giao diện khởi động quá lâu.");
          state.window.show();
        }
      }, 12000).unref();
      backups
        .daily(state.store)
        .catch((e) => state.log(`daily backup: ${e.message}`));
      if (smoke) {
        const smokeNavigation = require("./smokeNavigation");
        await smokeNavigation.checkReady(state);
        const scenario = await smokeInitial.exercise(state, base);
        await smokeNavigation.exercise(state);
        const headings = await smokePages.exercise(state, base, scenario);
        const numeric = await state.window.webContents
          .executeJavaScript(`(() => {
      const inputs=[...document.querySelectorAll('input[type=number]')];
      const allMinZero=inputs.every(x=>x.min==='0');
      const first=inputs[0]; first.value='-5'; first.dispatchEvent(new Event('input',{bubbles:true}));
      return {count:inputs.length,allMinZero,negativeCleared:first.value===''};
    })()`);
        if (!numeric.count || !numeric.allMinZero || !numeric.negativeCleared)
          throw Error(`Kiểm tra ô số thất bại: ${JSON.stringify(numeric)}`);
        console.log(`Numeric inputs: ${JSON.stringify(numeric)}`);
        const dates = await state.window.webContents.executeJavaScript(`(() => {
      const input=document.querySelector('[name=due]'),before=input.parentElement.querySelector('.date-display').textContent;
      document.querySelector('[data-action=days7]').click();
      return {before,after:input.parentElement.querySelector('.date-display').textContent,value:input.value,summary:document.querySelector('#dueText').textContent};
    })()`);
        if (
          !/^\d{2}\/\d{2}\/\d{2}$/.test(dates.after) ||
          !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(dates.value) ||
          dates.after !== dates.summary ||
          dates.after === dates.before
        )
          throw Error(`Hiển thị ngày không đúng: ${JSON.stringify(dates)}`);
        console.log(`Date display: ${JSON.stringify(dates)}`);
        const shot = path.join(base, "invoiceForm.png");
        await capture(state.window, shot);
        await state.window.webContents.executeJavaScript(
          "document.querySelector('[data-route=dashboard]').click();true",
        );
        await smokeInteractions.answer(state.window.webContents);
        await new Promise((resolve) => setTimeout(resolve, 350));
        await smokeInteractions.collectDashboard(state, scenario.invoice);
        await smokeBackup.exercise(state);
        await smokeInteractions.exercise(state, base);
        await smokeResponsive.exercise(state, base);
        await smokeBrand.exercise(state, base);
        await smokeCloseGuard.exercise(state);
        console.log(headings.join("\n"));
        console.log(`Screenshot: ${shot}`);
        state.store.close();
        app.quit();
        return;
      }
      app.on("window-all-closed", () => {
        state.store.close();
        app.quit();
      });
    })
    .catch((error) => {
      console.error(error);
      app.exit(1);
    });
