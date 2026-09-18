# Hiiscript

Hiiscript is an open source screenplay writer built as a small Electron and Capacitor-ready app.

Created by [Kabrownie Digital](https://kabrownie.digital).

**Project page:** [kabrownie.github.io/Hiiscript](https://kabrownie.github.io/Hiiscript)

**Download the latest release:** [GitHub Releases](https://github.com/kabrownie/Hiiscript/releases/latest)

## Privacy

Hiiscript is offline-first. Scripts, settings, characters, and scene suggestions are stored locally on the user's device. The app has no accounts, advertising, analytics, tracking pixels, or background screenplay uploads. Draft files are written only when the user chooses **Save**.

PDF import may download the open-source PDF.js library from a public CDN the first time it is used. The PDF is processed locally in the app; no screenplay upload service is used.

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

Use **Front page** to add title-page metadata, and **Page break** to insert a new screenplay page. Recovery snapshots are written to local browser storage while you edit; **Save** and **Open** use JSON draft files in Electron (or browser downloads/file selection on the web). **Fountain** and **Markdown** export create portable text files. The editor also includes undo/redo, find and replace, scene navigation, focus mode, word/page/runtime statistics, and drag-and-drop import.

On first launch, Hiiscript opens **The Last Signal**, a clearly labeled superhero starter template. Create a new script or dismiss the notice when you are ready to begin your own screenplay.

The **Library** manages saved character and scene suggestions. Entries can be added, renamed, deleted, or transferred as JSON. Preview pages paginate automatically when screenplay content reaches the letter-page boundary.

## Build Instructions

## Download The First Release

For the newest installers, use the [latest GitHub Release](https://github.com/kabrownie/Hiiscript/releases/latest).

Choose the file for your computer from the `dist/` folder:

- **Windows:** `Hiiscript-1.0.0-portable-x64.exe` is the portable app. Double-click it; no installation is required. The `-setup-x64.exe` file is the installable version.
- **Linux, easiest:** `hiiscript-1.0.0-x86_64.AppImage`. Download it, right-click **Properties > Permissions**, allow it to run as a program, then double-click it.
- **Ubuntu/Debian:** `hiiscript-1.0.0-amd64.deb`. Double-click it and choose **Install**.

Unsigned builds may show a Windows unknown-publisher warning. Tagged GitHub releases can be signed by configuring `WINDOWS_CERTIFICATE_BASE64` and `WINDOWS_CERTIFICATE_PASSWORD` repository secrets; the release workflow publishes SHA-256 checksums automatically. Confirm that any file came from the official Hiiscript release page before opening it.

The app runs offline after installation. Start with the included template, choose **+ New** for a blank script, or choose **New from template** for another copy of the superhero example.

### First-time setup

```bash
npm install
```

### Linux desktop app

```bash
npm run build:linux
```

Builds are written to `dist/`:

- `hiiscript-1.0.0-x86_64.AppImage` runs without installation.
- `hiiscript-1.0.0-amd64.deb` installs with `sudo dpkg -i`.

### Windows desktop app

```bash
npm run build:win
```

This creates an NSIS installer and a portable executable in `dist/`. Electron Builder supports cross-compiling between Linux and Windows. macOS targets require macOS.

Windows Defender may identify an unsigned build as an unknown publisher. Removing that warning requires a code-signing certificate and a signed release build. The workflow supports an encoded `.p12`/`.pfx` certificate through `WINDOWS_CERTIFICATE_BASE64` and its password through `WINDOWS_CERTIFICATE_PASSWORD`.

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

Run the core smoke tests with:

```bash
npm test
```

- Browser: open `www/index.html` directly.
- Electron: run `npm run dev` or press F5 in VS Code.
- Android: run `npm run android:open` for live testing in Android Studio.

Keep `www/index.html` as the single source of truth. Electron reads it on every launch; run `npm run android:sync` after web changes so the Android project receives them.

## Project layout

- `www/` contains the web editor.
- `electron/` contains the Electron main process and secure preload bridge.
- `images/` contains the Kabrownie logo, favicon, and desktop app icons used by packaged builds.
- `capacitor.config.json` configures the shared web bundle for native targets.
- `.vscode/` contains launch and task definitions for local development.

Shared screenplay rules live in `www/js/screenplay-core.js`; accessibility helpers live in `www/js/accessibility.js`. The HTML file still owns the editor controller and markup, but reusable classification and data normalization are now testable outside the browser.
