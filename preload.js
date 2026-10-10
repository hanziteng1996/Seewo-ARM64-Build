const { contextBridge, ipcRenderer } = require('electron');



contextBridge.exposeInMainWorld('electron', {

  sendToHost: (type, data) => ipcRenderer.send('seewo:host', { type, data }),

  invokeToMain: (channel, data) => ipcRenderer.invoke('seewo:invoke-main', { channel, data }),

  listener: (name, cb) => ipcRenderer.on('seewo:listener:' + name, (event, data) => cb(data)),

  invoke: async ({ name, params, callBack }) => {

    try {

      const result = await ipcRenderer.invoke('seewo:ipc-request', { channel: name, data: params });

      if (callBack) callBack(result);

      return result;

    } catch (e) {

      if (callBack) callBack(undefined);

      return undefined;

    }

  },

});