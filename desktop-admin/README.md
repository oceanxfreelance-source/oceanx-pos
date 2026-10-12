# OceanX Admin — Windows app for the OceanX office

The Super Admin console as its own Windows program. It opens Super Admin at its own address
(https://oceanx-admin.vercel.app, later admin.oceanx.app) in its own window. It keeps no data of its own:
everything stays on the server, so it is always up to date.

## Install

1. Download `OceanX-Admin-Setup-<version>.exe` from the GitHub release "OceanX Admin for Windows".
2. Double-click it. Windows may say "Windows protected your PC" (the file is not code-signed yet):
   click **More info → Run anyway**.
3. Click **Install**. An **OceanX Admin** icon appears on the desktop and the app opens.
4. Sign in with your Super Admin email and password.

Shortcuts: F5 reload · F11 full screen · Ctrl + / Ctrl − text size · Alt+Home main office.
Without internet it shows "No internet connection" and reconnects by itself.

## Build

`npm ci && npm run build:win` (on Windows), or push a change under `desktop-admin/`: the
"Admin desktop app" GitHub workflow builds the installer and publishes it as a release.
To publish a new version, raise `version` in package.json.
