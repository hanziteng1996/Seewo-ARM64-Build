const { app, BrowserWindow, Menu, session, dialog, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const TARGET_URL = 'https://enweb3.seewo.com/';

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

  function createChildWindow(url) {
    const win = new BrowserWindow({
      width: 1280,
      height: 800,
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: false,
        nodeIntegration: false,
        preload: path.join(__dirname, 'preload.js'),
      },
    });
    win.loadURL(url);
    return win;
  }

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      backgroundColor: '#ffffff',
      icon: resolveIcon(),
      webPreferences: {
        contextIsolation: false,
        nodeIntegration: false,
        preload: path.join(__dirname, 'preload.js'),
      },
    });

    mainWindow.loadURL(TARGET_URL);
    mainWindow.on('closed', () => { mainWindow = null; });

    mainWindow.webContents.setWindowOpenHandler(() => ({
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 1280,
        height: 800,
        autoHideMenuBar: true,
        webPreferences: {
          contextIsolation: false,
          nodeIntegration: false,
          preload: path.join(__dirname, 'preload.js'),
        },
      },
    }));

    mainWindow.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith(TARGET_URL)) {
        event.preventDefault();
        createChildWindow(url);
      }
    });
  }

  // ===== 希沃 Electron 桥 IPC 处理 =====
  // sendToHost 的实现模拟 Web 降级路径的行为，只对导入/打印做特殊处理

  ipcMain.on('seewo:host', (event, { type, data }) => {
    const wc = event.sender;
    switch (type) {
      case 'OPEN_SYSTEM_PRINTING_SETTING':
        wc.print();
        break;
      case 'OPEN_LOCAL_COURSEWARE':
        dialog.showOpenDialog(mainWindow, {
          title: '导入课件',
          properties: ['openFile'],
          filters: [
            { name: '希沃课件', extensions: ['enbx'] },
            { name: 'PPT 课件', extensions: ['pptx', 'ppt'] },
          ],
        }).then(({ canceled, filePaths }) => {
          if (!canceled && filePaths[0]) {
            wc.send('seewo:listener:OPEN_LOCAL_COURSEWARE', filePaths[0]);
          }
        });
        break;
      case 'openCourseware':
        if (data && data.id) {
          createChildWindow(`${TARGET_URL}editing/web?ddtab=true#enbxId/${data.id}`);
        }
        break;
      case 'newCoursewareTemplate':
        if (data && data.parentId) {
          createChildWindow(`${TARGET_URL}courseware/newCourseware?parentId=${data.parentId}&type=web&ddtab=true`);
        } else {
          createChildWindow(`${TARGET_URL}courseware/newCourseware?type=web&ddtab=true`);
        }
        break;
      case 'newTeachingPlanTemplate':
        if (data) {
          createChildWindow(`${window.teachingPlanUrl || TARGET_URL}teaching-plan/create?group_id=${data}`);
        } else {
          createChildWindow(`${window.teachingPlanUrl || TARGET_URL}teaching-plan/create`);
        }
        break;
      case 'openTeachingPlan':
        if (data && data.uid) {
          createChildWindow(`${window.teachingPlanUrl || TARGET_URL}teaching-plan/edit/${data.uid}`);
        }
        break;
      case 'LOGOUT':
      case 'reLogin':
        wc.loadURL(TARGET_URL);
        break;
      case 'openExternal':
        if (data && data.url) shell.openExternal(data.url);
        break;
      case 'reFreshCoursewareList':
      case 'disableTabsHead':
      case 'UNAUTHORIZED':
      case 'updateTabTitle':
      case 'updateTeachingPlan':
        break;
      default:
        break;
    }
  });

  ipcMain.on('seewo:main', (event, { channel, data }) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('seewo:ipc-on:' + channel, data);
    }
  });

  ipcMain.handle('seewo:invoke-main', (event, { channel, data }) => {
    return undefined;
  });

  ipcMain.handle('seewo:exit', () => { app.quit(); });

  ipcMain.handle('seewo:toggle-fullscreen', (event, flag) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.setFullScreen(!!flag);
  });

  ipcMain.handle('seewo:resize-window', (event, config) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && config) {
      if (config.width && config.height) win.setSize(config.width, config.height);
      else if (config.size && config.size.width && config.size.height) {
        win.setSize(config.size.width, config.size.height);
      }
    }
  });

  ipcMain.handle('seewo:set-resizable', (event, resizable) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.setResizable(!!resizable);
  });

  ipcMain.handle('seewo:show-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) { win.show(); win.focus(); }
  });

  ipcMain.handle('seewo:memorize-window', () => {});

  ipcMain.handle('seewo:reset-window', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.setSize(1280, 800);
  });

  ipcMain.handle('seewo:open-external', (event, url) => {
    if (url) shell.openExternal(url);
  });

  ipcMain.handle('seewo:handle-get-file', (event, filePath) => {
    if (!filePath) return undefined;
    try {
      return fs.readFileSync(filePath).toString('base64');
    } catch (e) {
      return undefined;
    }
  });

  ipcMain.handle('seewo:write-file', (event, data) => {
    if (!data || !data.path) return false;
    try {
      fs.writeFileSync(data.path, data.content || '');
      return true;
    } catch (e) {
      return false;
    }
  });

  ipcMain.handle('seewo:cancel-download', () => true);

  ipcMain.handle('seewo:get-media-sources', () => []);

  ipcMain.handle('seewo:sso-logout', (event) => {
    event.sender.loadURL(TARGET_URL);
  });

  ipcMain.handle('seewo:get-login-info', () => undefined);
  ipcMain.handle('seewo:get-login-info-by-uid', () => undefined);

  ipcMain.handle('seewo:ipc-request', (event, { channel, data }) => {
    switch (channel) {
      case 'GetIsInDisplayBoardMode':
        return false;
      case 'GetSystemInfo':
        return { platform: 'win32', arch: 'arm64' };
      case 'GetFontList':
        return [];
      case 'GetOpsInfo':
      case 'GetSandboxInfo':
        return {};
      default:
        return undefined;
    }
  });

  ipcMain.on('seewo:ipc-send', () => {});

  // ===== 下载处理 =====
  app.whenReady().then(() => {
    session.defaultSession.on('will-download', (event, item) => {
      const filename = item.getFilename();
      const defaultPath = path.join(app.getPath('downloads'), filename);
      dialog.showSaveDialog(mainWindow, {
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
            shell.showItemInFolder(filePath);
          }
        });
      });
    });

    Menu.setApplicationMenu(null);
    createWindow();
  });

  app.on('window-all-closed', () => app.quit());
}