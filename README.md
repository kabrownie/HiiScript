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

## Project layout

- `www/` contains the web editor.
- `electron/` contains the Electron main process and secure preload bridge.
- `capacitor.config.json` configures the shared web bundle for native targets.
- `.vscode/` contains launch and task definitions for local development.
