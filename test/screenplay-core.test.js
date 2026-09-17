const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../www/js/screenplay-core.js");

test("normalizes saved character and scene libraries", () => {
  const result = core.normalizeLibrary({characters:[" alice ", "ALICE", ""], scenes:["int. classroom - day", "INT. CLASSROOM - DAY"]});
  assert.deepEqual(result.characters, ["ALICE"]);
  assert.deepEqual(result.scenes, ["INT. CLASSROOM - DAY"]);
});

test("recognizes screenplay names and scene headings", () => {
  assert.equal(core.isCharacterName("BENS FATHER"), true);
  assert.equal(core.isCharacterName("a person"), false);
  assert.equal(core.isSceneHeading("INT. CLASSROOM - DAY"), true);
  assert.equal(core.isSceneHeading("BENS HOUSE"), false);
});

test("classifies common screenplay lines", () => {
  assert.equal(core.detectType("INT. CLASSROOM - DAY"), "scene");
  assert.equal(core.detectType("BENS FATHER"), "character");
  assert.equal(core.detectType("(quietly)"), "paren");
  assert.equal(core.detectType("=== "), "pagebreak");
});
