const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsApi', {
  load: () => ipcRenderer.invoke('settings:load'),
  printers: () => ipcRenderer.invoke('settings:printers'),
  save: (s) => ipcRenderer.invoke('settings:save', s),
  testPrint: (printer) => ipcRenderer.invoke('settings:test-print', printer),
  close: () => ipcRenderer.send('settings:close'),
});
