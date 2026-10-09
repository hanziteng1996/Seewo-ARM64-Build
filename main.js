const { app, BrowserWindow, Menu, session, dialog, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const TARGET_URL = 'https://enweb3.seewo.com/';

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  let mainWindow = null;
  let pendingExportPath = null;
  let pendingExportTimer = null;

  function setPendingExportPath(filePath) {
    pendingExportPath = filePath;
    if (pendingExportTimer) clearTimeout(pendingExportTimer);
    pendingExportTimer = setTimeout(() => { pendingExportPath = null; }, 60000);
  }

  function getAndClearPendingExportPath() {
    const p = pendingExportPath;
    pendingExportPath = null;
    if (pendingExportTimer) { clearTimeout(pendingExportTimer); pendingExportTimer = null; }
    return p;
  }

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
          createChildWindow(`${TARGET_URL}teaching-plan/create?group_id=${data}`);
        } else {
          createChildWindow(`${TARGET_URL}teaching-plan/create`);
        }
        break;
      case 'openTeachingPlan':
        if (data && data.uid) {
          createChildWindow(`${TARGET_URL}teaching-plan/edit/${data.uid}`);
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
      case 'webview::click':
      case 'editingStatus':
      case 'goToHomePage':
      case 'ACTIVATE':
        break;
      default:
        break;
    }
  });

  ipcMain.on('seewo:main', (event, { channel, data }) => {
    switch (channel) {
      case 'updateSavePathMap':
        if (data && data.savePath) {
          setPendingExportPath(data.savePath);
        }
        break;
      default:
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send('seewo:ipc-on:' + channel, data);
        }
        break;
    }
  });

  ipcMain.handle('seewo:invoke-main', async (event, { channel, data }) => {
    switch (channel) {
      case 'openEditingExportDialog': {
        const filename = data || 'courseware';
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
          title: '导出课件',
          defaultPath: path.join(app.getPath('downloads'), filename),
          filters: [
            { name: '希沃课件 (.enbx)', extensions: ['enbx'] },
            { name: 'PowerPoint (.pptx)', extensions: ['pptx'] },
            { name: 'PDF (.pdf)', extensions: ['pdf'] },
            { name: '图片 (.png)', extensions: ['png'] },
          ],
        });
        if (canceled || !filePath) return undefined;
        setPendingExportPath(filePath);
        return filePath;
      }
      case 'saveBase64Img': {
        if (!data || !data.savePath || !data.base64String) return false;
        try {
          const dir = path.dirname(data.savePath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          const buffer = Buffer.from(data.base64String, 'base64');
          fs.writeFileSync(data.savePath, buffer);
          return true;
        } catch (e) {
          console.error('saveBase64Img error:', e);
          return false;
        }
      }
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

  ipcMain.handle('seewo:write-file', (event, filePath, content, isBinary) => {
    if (!filePath) return false;
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (isBinary && content) {
        const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
        fs.writeFileSync(filePath, buffer);
      } else {
        fs.writeFileSync(filePath, content || '');
      }
      return true;
    } catch (e) {
      console.error('write-file error:', e);
      return false;
    }
  });

  ipcMain.handle('seewo:save-blob', async (event, { filename, data }) => {
    let filePath = getAndClearPendingExportPath();
    if (!filePath) {
      const { canceled, filePath: selectedPath } = await dialog.showSaveDialog(mainWindow, {
        title: '保存文件',
        defaultPath: path.join(app.getPath('downloads'), filename),
      });
      if (canceled || !selectedPath) return false;
      filePath = selectedPath;
    }
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
      fs.writeFileSync(filePath, buffer);
      shell.showItemInFolder(filePath);
      return true;
    } catch (e) {
      console.error('save-blob error:', e);
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

  ipcMain.on('seewo:ipc-send', () => {});

  // ===== 下载处理（非 blob 下载的 fallback） =====
  app.whenReady().then(() => {
    session.defaultSession.on('will-download', (event, item) => {
      const filename = item.getFilename();
      const pendingPath = getAndClearPendingExportPath();
      if (pendingPath) {
        item.setSavePath(pendingPath);
        item.once('done', (e, state) => {
          if (state === 'completed') {
            shell.showItemInFolder(pendingPath);
          }
        });
        return;
      }
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
