const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packageJsonPath = path.join(root, "package.json");
const appPath = path.join(root, "www", "js", "app.js");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const version = packageJson.version;

if (typeof version !== "string" || !version) {
  throw new Error("package.json must contain a non-empty version");
}

const app = fs.readFileSync(appPath, "utf8");
const versionDeclaration = /^const APP_VERSION = "([^"]+)";$/m;
const match = app.match(versionDeclaration);

if (!match) {
  throw new Error(`Could not find APP_VERSION declaration in ${path.relative(root, appPath)}`);
}

const updatedApp = app.replace(versionDeclaration, `const APP_VERSION = "${version}";`);
if (updatedApp !== app) {
  fs.writeFileSync(appPath, updatedApp);
}

console.log(`Injected APP_VERSION=${version} into ${path.relative(root, appPath)}`);
