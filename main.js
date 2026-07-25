const { app, BrowserWindow, Menu } = require('electron');
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

    mainWindow.loadURL(TARGET_URL);
    mainWindow.on('closed', () => { mainWindow = null; });
  }

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);   // ← 去菜单，就这一行
    createWindow();
  });

  app.on('window-all-closed', () => app.quit());
}
