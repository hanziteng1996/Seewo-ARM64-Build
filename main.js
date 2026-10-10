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

    mainWindow.webContents.on('did-fail-load', (event, code, desc, url) => {
      console.log('did-fail-load:', code, desc, url);
    });

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

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);

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
      switch (channel) {
        case 'openEditingExportDialog': {
          const filename = data || 'courseware';
          return dialog.showSaveDialog(mainWindow, {
            title: '导出课件',
            defaultPath: path.join(app.getPath('downloads'), filename),
            filters: [
              { name: '希沃课件 (.enbx)', extensions: ['enbx'] },
              { name: 'PowerPoint (.pptx)', extensions: ['pptx'] },
              { name: 'PDF (.pdf)', extensions: ['pdf'] },
              { name: '图片 (.png)', extensions: ['png'] },
            ],
          }).then(({ canceled, filePath }) => {
            if (canceled || !filePath) return undefined;
            setPendingExportPath(filePath);
            return filePath;
          });
        }
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

    ipcMain.handle('seewo:write-file', (event, a, b, c) => {
      let filePath, content, isBinary;
      if (a && typeof a === 'object' && !Buffer.isBuffer(a) && !(a instanceof ArrayBuffer) && ('path' in a)) {
        filePath = a.path;
        content = a.content;
        isBinary = a.isBinary;
      } else {
        filePath = a;
        content = b;
        isBinary = c;
      }
      if (!filePath) return false;
      try {
        if (isBinary && content && content.byteLength !== undefined) {
          fs.writeFileSync(filePath, Buffer.from(content));
        } else {
          fs.writeFileSync(filePath, content || '');
        }
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

    session.defaultSession.on('will-download', (event, item) => {
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

    createWindow();
  });

  app.on('window-all-closed', () => app.quit());
}