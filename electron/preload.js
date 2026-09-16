const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('screenBridge', {
  save: (content) => ipcRenderer.invoke('draft:save', content),
  open: () => ipcRenderer.invoke('draft:open')
});
