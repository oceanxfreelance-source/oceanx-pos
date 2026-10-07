// Per-PC settings (server address, receipt printer), saved in the app's data folder.
const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const pkg = require('../package.json');

const file = () => path.join(app.getPath('userData'), 'settings.json');
const defaults = { serverUrl: pkg.oceanx.serverUrl, printer: '', fullscreen: false };

function load() {
  try {
    return { ...defaults, ...JSON.parse(fs.readFileSync(file(), 'utf8')) };
  } catch {
    return { ...defaults };
  }
}

function save(next) {
  const merged = { ...load(), ...next };
  // Only plain https/http addresses are accepted as the server.
  try {
    const u = new URL(merged.serverUrl);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('bad protocol');
    merged.serverUrl = u.origin;
  } catch {
    merged.serverUrl = defaults.serverUrl;
  }
  merged.printer = String(merged.printer || '').slice(0, 200);
  merged.fullscreen = !!merged.fullscreen;
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(merged, null, 2));
  return merged;
}

module.exports = { load, save, defaults };
