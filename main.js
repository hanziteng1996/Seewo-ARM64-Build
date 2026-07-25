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
// ===================== 保险版：粘到 main.js 最末尾 =====================
import('electron').then(function (electron) {
  var Menu = electron.Menu;
  var app = electron.app;

  // 修复1：去掉顶部菜单栏（File / Edit / View / Window / Help）
  if (Menu) Menu.setApplicationMenu(null);

  // 修复2：把网页的 window.close 偷换成“后退”= 关课件回首页，不影响右上角 X 退出
  if (app) {
    app.on('web-contents-created', function (event, wc) {
      wc.on('did-finish-load', function () {
        wc.executeJavaScript(
          '(function(){' +
          'if(window.__seewoClosePatched)return;' +
          'window.__seewoClosePatched=true;' +
          'window.close=function(){' +
          'try{var t=window.top;if(t&&t!==window&&t.history&&t.history.length>1){t.history.back();return;}}catch(e){}' +
          'if(window.history&&window.history.length>1){window.history.back();}' +
          '};' +
          '})();'
        ).catch(function () {});
      });
    });
  }
}).catch(function () {});
// ===================== 保险版结束 =====================
