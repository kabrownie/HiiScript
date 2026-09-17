const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const core = require("../www/js/screenplay-core.js");

const script = fs.readFileSync(
  path.join(__dirname, "fixtures", "superhero-2-minute.fountain"),
  "utf8"
);

test("the two-minute superhero sample contains the expected screenplay elements", () => {
  const lines = script.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const scenes = lines.filter(line => core.isSceneHeading(line));
  const characters = lines.filter(line => core.detectType(line) === "character");

  assert.equal(scenes.length, 1);
  assert.ok(characters.includes("NOVA"));
  assert.ok(characters.includes("VEX"));
  assert.match(script, /\(to herself\)/);
  assert.match(script, /FADE OUT\./);
  assert.match(script, /> THE END </);
  const wordCount = script.split(/\s+/).length;
  assert.ok(wordCount >= 150 && wordCount <= 400);
});
