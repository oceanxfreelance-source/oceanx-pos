// Bridge for the OceanX web app: lets it know it runs in the desktop app and print without the dialog.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('oceanxDesktop', {
  isDesktop: true,
  version: ipcRenderer.sendSync('desktop:version'),
  /** Print this window: straight to the chosen receipt printer, or the normal print dialog if none is set. */
  print: () => ipcRenderer.invoke('desktop:print'),
  openSettings: () => ipcRenderer.send('desktop:open-settings'),
});
