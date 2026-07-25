const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const TARGET_URL = 'https://enweb3.seewo.com/';

// 单实例锁：防止误开多个程序
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  let mainWindow = null;

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  function resolveIcon() {
    const candidates = [
      path.join(__dirname, 'logo.ico'),
      path.join(process.resourcesPath || '', 'logo.ico'),
    ];
    for (const c of candidates) {
      try { if (c && fs.existsSync(c)) return c; } catch (e) {}
    }
    return undefined;
  }

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      backgroundColor: '#ffffff',
      icon: resolveIcon(),
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    // ★ 核心总闸：所有新窗口请求 → 同窗口跳转
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (url) mainWindow.loadURL(url).catch(() => {});
      return { action: 'deny' };
    });

    mainWindow.loadURL(TARGET_URL);
    mainWindow.on('closed', () => { mainWindow = null; });
  }

  app.whenReady().then(createWindow);
  app.on('window-all-closed', () => app.quit());
}
// ===================== 粘到 main.js【最末尾】开始 =====================

// 修复1：去掉顶部多出来的菜单栏（File / Edit / View / Window / Help）
require('electron').Menu.setApplicationMenu(null);

// 修复2：把网页里的 window.close() 偷换成“后退”。
//   这样点“关闭课件”= 返回首页，而不是退出整个 app。
//   用 web-contents-created 全局拦截：主窗口 + 所有 iframe 都覆盖，
//   且【不影响】你点窗口右上角 X 正常退出。
require('electron').app.on('web-contents-created', function (event, wc) {
  wc.on('did-finish-load', function () {
    wc.executeJavaScript(`
      (function () {
        if (window.__seewoClosePatched) return;
        window.__seewoClosePatched = true;
        window.close = function () {
          try {
            var t = window.top;
            if (t && t !== window && t.history && t.history.length > 1) {
              t.history.back();   // 在 iframe 里：让顶层窗口后退
              return;
            }
          } catch (e) {}
          if (window.history && window.history.leng
