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

test("validates drafts and rejects malformed or oversized content", () => {
  const draft = core.validateDraft({text:"INT. ROOM - DAY", title:"Draft"});
  assert.equal(draft.title, "Draft");
  assert.deepEqual(draft.lines, []);
  assert.throws(() => core.validateDraft({text: 42}), /text is required/);
  assert.throws(() => core.validateDraft({text:"12345"}, 4), /too large/);
});

test("normalizes Fountain and calculates writing statistics", () => {
  assert.equal(core.normalizeFountainText("A\r\nB  \n"), "A\nB\n");
  assert.deepEqual(core.getScriptStats("one two three"), {words:3, pages:1, minutes:1});
  assert.match(core.fountainToMarkdown("INT. ROOM - DAY\n\nMARY\nHello"), /## INT\. ROOM - DAY/);
  assert.match(core.fountainToMarkdown("INT. ROOM - DAY\n\nMARY\nHello"), /### MARY/);
});

test("classifies supported screenplay element types", () => {
  assert.equal(core.detectType("!A forced action"), "action");
  assert.equal(core.detectType(". INT. ROOM - DAY"), "scene");
  assert.equal(core.detectType("@MARY"), "character");
  assert.equal(core.detectType("> CUT TO:"), "transition");
  assert.equal(core.detectType("> THE END <"), "centered");
  assert.equal(core.detectType("# ACT ONE"), "section");
  assert.equal(core.detectType("= a beat"), "synopsis");
  assert.equal(core.detectType("[[private note]]"), "note");
});

test("handles large scripts without losing word statistics", () => {
  const script = Array.from({length: 10000}, () => "word").join(" ");
  const stats = core.getScriptStats(script);
  assert.equal(stats.words, 10000);
  assert.equal(stats.pages, 40);
});
