// OceanX Admin (Windows): the Super Admin console in its own window, always at Super Admin's own address.
// It holds no data of its own; everything stays on the server, so it is always up to date.
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('node:path');
const pkg = require('../package.json');

const ADMIN_URL = pkg.oceanx.adminUrl;
const HOME = `${ADMIN_URL}/superadmin`;

if (!app.requestSingleInstanceLock()) app.quit();

let main = null;
const isOurs = (url) => {
  try {
    return new URL(url).origin === new URL(ADMIN_URL).origin;
  } catch {
    return false;
  }
};
const webPrefs = () => ({ contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true });

/** Super Admin pages open inside the app (printed invoices in their own window); anything else opens in the normal browser. */
function guard(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isOurs(url)) return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, width: 1000, height: 900, icon: path.join(__dirname, 'icon.png'), webPreferences: webPrefs() } };
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

const goHome = () => main && void main.loadURL(HOME);

function createMain() {
  main = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 680,
    show: false,
    title: 'OceanX Admin',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#03213a',
    autoHideMenuBar: true,
    webPreferences: webPrefs(),
  });
  guard(main);
  main.once('ready-to-show', () => {
    main.maximize();
    main.show();
  });
  // No internet: a friendly page that tries again by itself.
  main.webContents.on('did-fail-load', (_e, code, _desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return;
    void main.loadFile(path.join(__dirname, 'offline.html'), { query: { url: url || HOME } });
  });
  main.on('closed', () => (main = null));
  goHome();
}

function buildMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'OceanX Admin',
        submenu: [
          { label: 'Main office', accelerator: 'Alt+Home', click: goHome },
          { label: 'Reload', accelerator: 'F5', click: () => main?.webContents.reload() },
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
      { label: 'Help', submenu: [{ label: `Version ${app.getVersion()}`, enabled: false }] },
    ]),
  );
}

app.on('second-instance', () => {
  if (!main) return;
  if (main.isMinimized()) main.restore();
  main.focus();
});
app.whenReady().then(() => {
  app.setAppUserModelId('app.oceanx.admin');
  buildMenu();
  createMain();
});
app.on('window-all-closed', () => app.quit());
