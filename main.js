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
