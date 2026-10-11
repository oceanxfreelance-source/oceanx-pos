# Android apps: OceanX POS (tablets) and Gravity (phones)

One shell builds two apps (Gradle flavors in `app/build.gradle`):

| App | Flavor | Opens | Behaviour |
|---|---|---|---|
| OceanX POS (tablets) | `pos` | oceanx-pos-oceanx1.vercel.app/start | Full screen, sideways, screen kept on, POS only |
| Gravity (phones) | `gravity` | oceanx-gravity.vercel.app | Normal phone app: status bar, turns with the phone |

Both can print (A4), save PDFs to Downloads, choose photos and download exports. Gravity's name, purple
theme and icons are in `app/src/gravity/res`.

GitHub Actions (`.github/workflows/android-apps.yml`) builds both and publishes
`android-v<version>` (POS) and `gravity-android-v<version>` (Gravity). An existing release is never
replaced: bump `appVersion` / `gravityVersion` to publish a new one.

## OceanX POS tablet app

For restaurants and cafés: waiters taking orders at the table, the counter, and the kitchen display.
The app opens the live system full-screen, keeps the screen on during service and adds what a web page
cannot do inside an app: printing (Android print dialog, A4), saving PDFs to Downloads, choosing photos,
and downloading CSV exports.

The system itself updates on its own. The app only needs a new version when this shell changes
(bump `appVersion` / `appVersionCode` in `app/build.gradle`).

## Build

GitHub Actions builds it on every change under `android/` and publishes `OceanX-POS-Tablet-<version>.apk`
as a release (`android-v<version>`).

Signing: add two repository secrets so every version is signed with the same key (needed for updates to
install over the old version):

- `ANDROID_KEYSTORE_BASE64`: the keystore file, base64-encoded
- `ANDROID_KEYSTORE_PASSWORD`: its password (key alias `oceanx`)

Without them a temporary key is used.

## Install on a tablet

1. Open the release link on the tablet and download the APK.
2. Open it. Android asks to allow installs from the browser: allow it once.
3. Open **OceanX POS** and sign in.
