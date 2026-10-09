const { app, BrowserWindow, Menu, session, dialog, shell, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

const TARGET_URL = 'https://enweb3.seewo.com/';

// 显式启用文件系统访问 API（导入/导出可能用到 showOpenFilePicker / showSaveFilePicker）
app.commandLine.appendSwitch('enable-features', 'FileSystemAccessAPI');

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

    // 放行 window.open：导入/导出/打印预览等会 open('','_blank') 后 document.write，
    // 必须 action:'allow' 才能让 window.open 返回可写引用（deny 会返回 null 导致页面 JS 报错无反应）
    mainWindow.webContents.setWindowOpenHandler(() => ({
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 1024,
        height: 768,
        autoHideMenuBar: true,
        webPreferences: { contextIsolation: true, nodeIntegration: false },
      },
    }));

    // 防止点击链接把主窗口导航到外部站点
    mainWindow.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith(TARGET_URL)) {
        event.preventDefault();
        const win = new BrowserWindow({
          width: 1024,
          height: 768,
          autoHideMenuBar: true,
          webPreferences: { contextIsolation: true, nodeIntegration: false },
        });
        win.loadURL(url);
      }
    });
  }

  // 下载处理：弹出"另存为"对话框，下载完成后通知并打开所在目录
  app.whenReady().then(() => {
    // 放行全部网页权限请求（文件系统访问/下载/剪贴板等），
    // Electron 默认拒绝会导致导入/导出/打印等功能静默失败、点击无反应
    session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => callback(true));
    session.defaultSession.setPermissionCheckHandler(() => true);

    // 记录渲染进程 console 日志（含错误）到 userData/console.log，便于定位按钮无反应问题
    app.on('browser-window-created', (event, win) => {
      win.webContents.on('console-message', (e, level, message, line, sourceId) => {
        try {
          const logPath = path.join(app.getPath('userData'), 'console.log');
          const ts = new Date().toISOString();
          fs.appendFileSync(logPath, `[${ts}] level=${level} ${sourceId}:${line} ${message}\n`);
        } catch (err) {}
      });
    });

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
