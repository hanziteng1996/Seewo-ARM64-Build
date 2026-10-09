const { app, BrowserWindow, Menu, session, dialog, shell, Notification } = require('electron');
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

    // 放行 window.open（打印/导出预览等可能用到新窗口）
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//.test(url)) {
        const win = new BrowserWindow({ width: 1024, height: 768, autoHideMenuBar: true });
        win.loadURL(url);
        return { action: 'deny' };
      }
      return { action: 'deny' };
    });
  }

  // 下载处理：弹出"另存为"对话框，下载完成后通知并打开所在目录
  app.whenReady().then(() => {
    session.defaultSession.on('will-download', (event, item) => {
      const filename = item.getFilename();
      const defaultPath = path.join(app.getPath('downloads'), filename);
      dialog.showSaveDialog({
        title: '保存下载',
        defaultPath,
      }).then(({ canceled, filePath }) => {
        if (canceled || !filePath) {
          item.cancel();
          return;
        }
        item.setSavePath(filePath);
        item.once('done', (e, state) => {
          if (state === 'completed') {
            if (Notification.isSupported()) {
              new Notification({ title: '下载完成', body: filename }).show();
            }
            shell.showItemInFolder(filePath);
          }
        });
      });
    });
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);   // ← 去菜单，就这一行
    createWindow();
  });

  app.on('window-all-closed', () => app.quit());
}
