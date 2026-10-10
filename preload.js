const { ipcRenderer } = require('electron');

window.channel = 'electron';

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
  writeFileToLocal: (data) => ipcRenderer.invoke('seewo:write-file', data),
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
