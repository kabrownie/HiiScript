# Hiiscript

Hiiscript is an open source screenplay writer built as a small Electron and Capacitor-ready app.

Created by [Kabrownie Digital](https://kabrownie.digital).

Hiiscript is open source software released under the [MIT License](LICENSE).

**Project page:** [kabrownie.github.io/Hiiscript](https://kabrownie.github.io/Hiiscript)

Support continued development: [Sponsor Hiiscript on GitHub](https://github.com/sponsors/kabrownie)

**Direct downloads:** [Windows installer](https://github.com/kabrownie/Hiiscript/releases/latest/download/Hiiscript-latest-windows-setup.exe) | [Windows portable](https://github.com/kabrownie/Hiiscript/releases/latest/download/Hiiscript-latest-windows-portable.exe) | [Linux AppImage](https://github.com/kabrownie/Hiiscript/releases/latest/download/Hiiscript-latest-linux.AppImage) | [Ubuntu/Debian](https://github.com/kabrownie/Hiiscript/releases/latest/download/Hiiscript-latest-linux.deb) | [Android APK](https://github.com/kabrownie/Hiiscript/releases/latest/download/Hiiscript-latest-android.apk)

**Release page:** [GitHub Releases](https://github.com/kabrownie/Hiiscript/releases/latest)

## Release 1.0.11
The 1.0.11  the latest production packaging pass for desktop and Android builds. It targets the same offline screenplay workflow, with the release pipeline configured for Linux, Windows, and Android artifact generation.

## Privacy

Hiiscript is offline-first. Scripts, settings, characters, and scene suggestions are stored locally on the user's device. The app has no accounts, advertising, analytics, tracking pixels, or background screenplay uploads. Draft files are written only when the user chooses **Save**.

PDF import uses the bundled open-source PDF.js reader and is processed locally in the app; no screenplay upload service or internet connection is required.

Two network requests exist, both opt-in or disclosed:

- **Update checks** (opt-in). If enabled in the About dialog, the app requests
  the latest release tag from `api.github.com` at most once every six hours.
  This shares your IP address with GitHub; nothing else is sent.
- **PDF import** (first use only). The bundled PDF.js reader is used offline.
  If the bundled copy is missing, the app falls back to a public CDN for the
  reader script.

## Developer Quick Start

```bash
npm install
npm start
```

To preview the web editor without Electron:

```bash
npm run web
```

The app saves Fountain files by default through a secure preload bridge. Project backups remain available as explicit JSON files, while the web preview downloads files directly.

Use **Front page** to add title-page metadata, and **Page break** to insert a new screenplay page. Recovery snapshots are written to local browser storage while you edit; **Save** and **Open** support Fountain, Markdown, and explicit JSON project backups. **Export** supports Fountain, Markdown, and offline PDF printing. The editor also includes undo/redo, find and replace, scene navigation, focus mode with Escape exit, word/page/runtime statistics, update notifications, and drag-and-drop import.

On first launch, Hiiscript opens **The Last Signal**, a clearly labeled superhero starter template. Create a new script or dismiss the notice when you are ready to begin your own screenplay.

The **Library** manages saved character and scene suggestions. Entries can be added, renamed, deleted, or transferred as JSON. Preview pages paginate automatically when screenplay content reaches the letter-page boundary.

## Download Hiiscript

Use the direct links above, or open the [latest GitHub Release](https://github.com/kabrownie/Hiiscript/releases/latest) to view checksums and release notes.

Choose a direct download below. Clicking a link downloads the latest published build instead of opening the release page:

- **Windows portable:** [Download the latest portable app](https://github.com/kabrownie/Hiiscript/releases/latest/download/Hiiscript-latest-windows-portable.exe). Double-click it; no installation is required.
- **Windows installer:** [Download the latest Windows installer](https://github.com/kabrownie/Hiiscript/releases/latest/download/Hiiscript-latest-windows-setup.exe).
- **Linux, easiest:** [Download the latest AppImage](https://github.com/kabrownie/Hiiscript/releases/latest/download/Hiiscript-latest-linux.AppImage). Allow it to run as a program, then double-click it.
- **Ubuntu/Debian:** [Download the latest DEB package](https://github.com/kabrownie/Hiiscript/releases/latest/download/Hiiscript-latest-linux.deb). Double-click it and choose **Install**.
- **Android:** [Download the latest Android APK](https://github.com/kabrownie/Hiiscript/releases/latest/download/Hiiscript-latest-android.apk). Open the downloaded file on your Android device to install it.

Unsigned builds may show a Windows unknown-publisher warning. Tagged GitHub releases can be signed by configuring `WINDOWS_CERTIFICATE_BASE64` and `WINDOWS_CERTIFICATE_PASSWORD` repository secrets; the release workflow publishes SHA-256 checksums automatically. Confirm that any file came from the official Hiiscript release page before opening it.

The app runs offline after installation. Start with the included template, choose **+ New** for a blank script, or choose **New from template** for another copy of the superhero example.

## For Developers

The commands below are only for developers who want to run the source code or create installers. If you only want to use Hiiscript, use the direct download links above instead.

## Collaborate

Contributions and ideas are welcome. You can help by reporting bugs, improving accessibility, testing releases, writing documentation, or adding features.

- [Report a bug or request a feature](https://github.com/kabrownie/HiiScript/issues/new/choose)
- [Browse open issues](https://github.com/kabrownie/HiiScript/issues)
- [Open a pull request](https://github.com/kabrownie/HiiScript/compare)
- [Sponsor the project](https://github.com/sponsors/kabrownie)

To contribute code, fork the repository, create a focused branch, run `npm test`, and open a pull request explaining what changed and how it was tested. Please keep changes focused and preserve the offline-first experience.

### Run from source

```bash
npm install
```

### Build Linux packages

```bash
npm run build:linux
```

Builds are written to `dist/`:

- `hiiscript-1.0.11-x86_64.AppImage` runs without installation.
- `hiiscript-1.0.11-amd64.deb` installs with `sudo dpkg -i`.

### Build Windows packages

```bash
npm run build:win
```

This creates an NSIS installer and a portable executable in `dist/`. Electron Builder supports cross-compiling between Linux and Windows. macOS targets require macOS.

Windows Defender may identify an unsigned build as an unknown publisher. Removing that warning requires a code-signing certificate and a signed release build. The workflow supports an encoded `.p12`/`.pfx` certificate through `WINDOWS_CERTIFICATE_BASE64` and its password through `WINDOWS_CERTIFICATE_PASSWORD`.

### Build the Android APK

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
`images/` is the canonical source. `www/images/` is a copy that must exist
for the web preview and Android builds, which cannot reach above `www/`.
After changing any file in `images/`, run:

```bash
npm run sync:images


## Performance

On Linux, Hiiscript disables GPU acceleration by default because a subset of
legacy and unstable drivers crash the renderer before the first paint. If your
system has working drivers, set `HIISCRIPT_FORCE_GPU=1` before launching to
enable hardware acceleration:

```bash
HIISCRIPT_FORCE_GPU=1 ./hiiscript-1.0.11-x86_64.AppImage

HIISCRIPT_DISABLE_GPU=1 Hiiscript.exe
```

Shared screenplay rules live in `www/js/screenplay-core.js`; accessibility helpers live in `www/js/accessibility.js`. The HTML file still owns the editor controller and markup, but reusable classification and data normalization are now testable outside the browser.
