const { ipcRenderer } = require('electron');

window.channel = 'electron';

window.saveAs = async function(blob, filename) {
  if (typeof blob === 'string') {
    const a = document.createElement('a');
    a.href = blob;
    a.download = filename || 'download';
    a.rel = 'noopener';
    document.body.appendChild(a);
    setTimeout(() => {
      try { a.dispatchEvent(new MouseEvent('click')); }
      catch (e) {
        const ev = document.createEvent('MouseEvents');
        ev.initMouseEvent('click', true, true, window, 0, 0, 0, 80, 20, false, false, false, false, 0, null);
        a.dispatchEvent(ev);
      }
      document.body.removeChild(a);
    }, 0);
    return;
  }
  const arrayBuffer = await blob.arrayBuffer();
  return ipcRenderer.invoke('seewo:save-blob', {
    filename: filename || blob.name || 'download',
    data: arrayBuffer,
  });
};

const bridge = {
  sendToHost: (type, data) => ipcRenderer.send('seewo:host', { type, data }),
  sendToMain: (channel, data) => ipcRenderer.send('seewo:main', { channel, data }),
  invokeToMain: (channel, data) => ipcRenderer.invoke('seewo:invoke-main', { channel, data }),
  sendToWebview: () => {},
  listener: (name, cb) => {
    const handler = (event, ...args) => cb(...args);
    ipcRenderer.on('seewo:listener:' + name, handler);
    return { add: () => {}, remove: () => ipcRenderer.removeListener('seewo:listener:' + name, handler) };
  },
  exit: () => ipcRenderer.invoke('seewo:exit'),
  loginSuccess: () => {},
  reLogin: () => { window.location.reload(); },
  toggleFullScreen: (flag) => ipcRenderer.invoke('seewo:toggle-fullscreen', flag),
  showSystemKeyboard: () => {},
  hideSystemKeyboard: () => {},
  writeFileToLocal: (filePath, content, isBinary) => ipcRenderer.invoke('seewo:write-file', filePath, content, isBinary),
  cancelCoursewareDownload: () => ipcRenderer.invoke('seewo:cancel-download'),
  getLogFile: () => '',
  getGlobalVariable: () => undefined,
  resizeWindow: (config) => ipcRenderer.invoke('seewo:resize-window', config),
  setResizable: (resizable) => ipcRenderer.invoke('seewo:set-resizable', resizable),
  showWindow: () => ipcRenderer.invoke('seewo:show-window'),
  memorizeWindow: () => ipcRenderer.invoke('seewo:memorize-window'),
  resetHeightWidth: () => ipcRenderer.invoke('seewo:reset-window'),
  getMediaSources: () => ipcRenderer.invoke('seewo:get-media-sources'),
  ssoLogout: () => ipcRenderer.invoke('seewo:sso-logout'),
  getLoginInfo: () => ipcRenderer.invoke('seewo:get-login-info'),
  getLoginInfoByUid: (uid) => ipcRenderer.invoke('seewo:get-login-info-by-uid', uid),
  downloadCourseware: () => true,
  handleGetFile: (path) => ipcRenderer.invoke('seewo:handle-get-file', path),
  openExternal: (url) => ipcRenderer.invoke('seewo:open-external', url),
  closeEditingPage: () => {},
  closeEditingPages: () => {},
  reFreshCoursewareList: () => {},
  startDisplay: () => {},
  getActivationRemainDays: () => 999,
  api: {
    ipc: {
      request: (channel, data) => ipcRenderer.invoke('seewo:ipc-request', { channel, data }),
      send: (channel, data) => ipcRenderer.send('seewo:ipc-send', { channel, data }),
      on: (channel, callback) => {
        const handler = (event, ...args) => callback(...args);
        ipcRenderer.on('seewo:ipc-on:' + channel, handler);
        return () => { ipcRenderer.removeListener('seewo:ipc-on:' + channel, handler); };
      },
    }
  }
};

window.electron = new Proxy(bridge, {
  get: (target, prop) => {
    if (prop in target) return target[prop];
    return (...args) => {
      console.log('[seewo-bridge] unhandled:', String(prop));
      return undefined;
    };
  }
});
