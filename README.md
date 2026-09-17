# Kabrownie Screen

Kabrownie Screen is an open source screenplay writer built as a small Electron and Capacitor-ready app.

## Run locally

```bash
npm install
npm start
```

To preview the web editor without Electron:

```bash
npm run web
```

The Electron app stores drafts as JSON files through a secure preload bridge. The web preview keeps the editor usable, but file dialogs require Electron.

Use **Front page** to add title-page metadata, and **Page break** to insert a new screenplay page. **Save** and **Open** use JSON draft files in Electron (or browser downloads/file selection on the web); **Export** creates portable Fountain text.

## Build Instructions

### First-time setup

```bash
npm install
```

### Linux desktop app

```bash
npm run build:linux
```

Builds are written to `dist/`:

- `Kabrownie Screen-1.0.0.AppImage` runs without installation.
- `kabrownie-screen_1.0.0_amd64.deb` installs with `sudo dpkg -i`.

### Windows desktop app

```bash
npm run build:win
```

This creates an NSIS installer and a portable executable in `dist/`. Electron Builder supports cross-compiling between Linux and Windows. macOS targets require macOS.

### Android APK

Run this once to add the native Android project:

```bash
npm run android:add
```

After changing `www/index.html`, sync and open Android Studio:

```bash
npm run android:sync
npm run android:open
```

In Android Studio, choose **Build > Build Bundle(s) / APK(s) > Build APK(s)**. The debug APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.

Or build it from the terminal:

```bash
npm run android:build
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

## Development Testing

- Browser: open `www/index.html` directly.
- Electron: run `npm run dev` or press F5 in VS Code.
- Android: run `npm run android:open` for live testing in Android Studio.

Keep `www/index.html` as the single source of truth. Electron reads it on every launch; run `npm run android:sync` after web changes so the Android project receives them.

## Project layout

- `www/` contains the web editor.
- `electron/` contains the Electron main process and secure preload bridge.
- `capacitor.config.json` configures the shared web bundle for native targets.
- `.vscode/` contains launch and task definitions for local development.
