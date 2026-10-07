// OceanX POS desktop app (Windows). Opens the online OceanX system in its own window, keeps the same
// data as the web and phones, and prints receipts straight to the receipt printer chosen in Settings.
const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require('electron');
const path = require('node:path');
const config = require('./config');

if (!app.requestSingleInstanceLock()) app.quit();

let main = null;
let settingsWin = null;
const isOurs = (url) => {
  try {
    return new URL(url).origin === config.load().serverUrl;
  } catch {
    return false;
  }
};

const webPrefs = () => ({
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  spellcheck: false,
});

/** Same-site links open inside the app; anything else (help pages, maps…) opens in the normal browser. */
function guard(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isOurs(url)) return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, width: 1000, height: 900, webPreferences: webPrefs() } };
    if (/^https?:/i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!isOurs(url) && !url.startsWith('file:')) {
      e.preventDefault();
      if (/^https?:/i.test(url)) void shell.openExternal(url);
    }
  });
  win.webContents.on('did-create-window', (child) => guard(child));
}

function loadApp() {
  if (!main) return;
  void main.loadURL(config.load().serverUrl);
}

function createMain() {
  const s = config.load();
  main = new BrowserWindow({
    width: 1366,
    height: 820,
    minWidth: 1000,
    minHeight: 640,
    show: false,
    title: 'OceanX POS',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    fullscreen: s.fullscreen,
    webPreferences: webPrefs(),
  });
  guard(main);
  // Hidden shortcuts (not in any menu): Ctrl+Shift+A opens the Super Admin sign-in for the OceanX team;
  // Ctrl+Shift+R goes back to the restaurant sign-in. Both pages still need their own password.
  main.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown' || !input.control || !input.shift || input.alt) return;
    const key = input.key.toLowerCase();
    if (key === 'a') {
      e.preventDefault();
      void main.loadURL(`${config.load().serverUrl}/superadmin/login`);
    } else if (key === 'r') {
      e.preventDefault();
      loadApp();
    }
  });
  main.once('ready-to-show', () => {
    main.maximize();
    main.show();
  });
  // No internet / server unreachable: show a friendly page that retries by itself.
  main.webContents.on('did-fail-load', (_e, code, _desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3 /* aborted by a redirect */) return;
    void main.loadFile(path.join(__dirname, 'offline.html'), { query: { url: url || s.serverUrl } });
  });
  main.on('closed', () => (main = null));
  loadApp();
}

function openSettings() {
  if (settingsWin) return settingsWin.focus();
  settingsWin = new BrowserWindow({
    width: 560,
    height: 620,
    parent: main ?? undefined,
    modal: !!main,
    resizable: false,
    minimizable: false,
    title: 'OceanX POS — Settings',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'settings-preload.js'), contextIsolation: true, sandbox: true },
  });
  void settingsWin.loadFile(path.join(__dirname, 'settings.html'));
  settingsWin.on('closed', () => (settingsWin = null));
}

function buildMenu() {
  const template = [
    {
      label: 'OceanX POS',
      submenu: [
        { label: 'Settings (printer, server)…', accelerator: 'CmdOrCtrl+,', click: openSettings },
        { type: 'separator' },
        { label: 'Reload', accelerator: 'F5', click: () => main?.webContents.reload() },
        { label: 'Home', accelerator: 'Alt+Home', click: loadApp },
        { type: 'separator' },
        { role: 'quit', label: 'Exit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'togglefullscreen', label: 'Full screen', accelerator: 'F11' },
        { role: 'zoomIn', label: 'Bigger text' },
        { role: 'zoomOut', label: 'Smaller text' },
        { role: 'resetZoom', label: 'Normal size' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: `Version ${app.getVersion()}`, enabled: false },
        { label: 'Developer tools', accelerator: 'Ctrl+Shift+I', click: () => BrowserWindow.getFocusedWindow()?.webContents.toggleDevTools() },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------- printing
ipcMain.on('desktop:version', (e) => (e.returnValue = app.getVersion()));
ipcMain.on('desktop:open-settings', openSettings);

/** Print the calling window. With a receipt printer chosen in Settings: silent, no dialog. */
ipcMain.handle('desktop:print', async (e) => {
  const printer = config.load().printer;
  return new Promise((resolve) => {
    e.sender.print({ silent: !!printer, deviceName: printer || undefined, printBackground: true, margins: { marginType: 'none' } }, (ok, reason) => {
      if (!ok && reason && reason !== 'cancelled') void dialog.showMessageBox({ type: 'warning', title: 'Printing', message: `Could not print: ${reason}`, detail: 'Check the printer in OceanX POS → Settings.' });
      resolve({ ok, reason: reason || null });
    });
  });
});

// ---------------------------------------------------------------- settings window
ipcMain.handle('settings:load', () => ({ ...config.load(), defaultServerUrl: config.defaults.serverUrl, version: app.getVersion() }));
ipcMain.handle('settings:printers', async () => {
  const wc = (main ?? settingsWin)?.webContents;
  const list = wc ? await wc.getPrintersAsync() : [];
  return list.map((p) => ({ name: p.name, displayName: p.displayName || p.name, isDefault: !!p.isDefault }));
});
ipcMain.handle('settings:save', (_e, s) => {
  const before = config.load();
  const saved = config.save(s);
  if (saved.serverUrl !== before.serverUrl) loadApp();
  if (main && saved.fullscreen !== before.fullscreen) main.setFullScreen(saved.fullscreen);
  return saved;
});
ipcMain.handle('settings:test-print', async (_e, printer) => {
  const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  const html = `<html><body style="font-family:sans-serif;width:70mm;text-align:center"><h2>OceanX POS</h2><p>Test print</p><p>${new Date().toLocaleString()}</p><p>✓ Printer works</p></body></html>`;
  await w.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  return new Promise((resolve) => {
    w.webContents.print({ silent: !!printer, deviceName: printer || undefined, margins: { marginType: 'none' } }, (ok, reason) => {
      w.destroy();
      resolve({ ok, reason: reason || null });
    });
  });
});
ipcMain.on('settings:close', () => settingsWin?.close());

// ---------------------------------------------------------------- app lifecycle
app.on('second-instance', () => {
  if (main) {
    if (main.isMinimized()) main.restore();
    main.focus();
  }
});
app.whenReady().then(() => {
  app.setAppUserModelId('app.oceanx.pos');
  buildMenu();
  createMain();
});
app.on('window-all-closed', () => app.quit());
