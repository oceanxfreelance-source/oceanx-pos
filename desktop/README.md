# OceanX POS — Windows desktop app

A Windows program for restaurant PCs. It opens the online OceanX system in its own window (same data as
the web and phones; updates to the system appear automatically) and prints receipts straight to the
receipt printer.

## Installing at a restaurant (OceanX team)

1. Copy `OceanX-POS-Setup-<version>.exe` to the restaurant PC (USB stick or download).
2. Double-click it. Windows may show "Windows protected your PC" because the file is not code-signed yet:
   click **More info → Run anyway**. Approve the administrator prompt.
3. Keep the suggested folder, click **Install**. A desktop icon **OceanX POS** is created and the app opens.
4. Sign in with the restaurant's email and password.
5. Receipt printer: menu **OceanX POS → Settings** (Ctrl+,). Choose the receipt printer, click
   **Print a test page**, then **Save**. From then on, **Print** on receipts and bills prints immediately
   without the print window. Tick **Open in full screen** for counter PCs.

The PC needs internet. Without it the app shows "No internet connection" and reconnects by itself.

Shortcuts: F5 reload · F11 full screen · Ctrl + / Ctrl − text size · Alt+Home back to the start page.

## Building the installer (developers)

```
cd desktop
npm install
npm run build:win      # → dist/OceanX-POS-Setup-<version>.exe
```

On Linux the build needs Wine (64- and 32-bit) for the installer step. The server address is in
`package.json` → `oceanx.serverUrl` (each PC can override it in Settings). Bump `version` for each release.
