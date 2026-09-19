const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('screenBridge', {
  save: (content, options) => ipcRenderer.invoke('draft:save', content, options),
  open: () => ipcRenderer.invoke('draft:open')
});
