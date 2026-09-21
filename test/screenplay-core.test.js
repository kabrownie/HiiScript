"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../www/js/screenplay-core.js");

/* ------------------------------------------------------------------ *
 * detectType — classification of individual lines
 * ------------------------------------------------------------------ */

test("detectType classifies scene headings", () => {
  assert.equal(core.detectType("INT. HOUSE - DAY"), "scene");
  assert.equal(core.detectType("EXT. PARK - NIGHT"), "scene");
  assert.equal(core.detectType("I/E. CAR - CONTINUOUS"), "scene");
  assert.equal(core.detectType(". Forced Scene"), "scene");
});

test("detectType classifies character cues", () => {
  assert.equal(core.detectType("MARY"), "character");
  assert.equal(core.detectType("JOHN"), "character");
});

test("detectType classifies transitions", () => {
  assert.equal(core.detectType("CUT TO:"), "transition");
  assert.equal(core.detectType("FADE OUT."), "transition");
  assert.equal(core.detectType("DISSOLVE TO:"), "transition");
});

test("detectType classifies parentheticals", () => {
  assert.equal(core.detectType("(whispering)"), "paren");
});

test("detectType falls back to action", () => {
  assert.equal(core.detectType("She walks across the room."), "action");
});

test("detectType handles blank, pagebreak, centered, section, synopsis, note", () => {
  assert.equal(core.detectType(""), "blank");
  assert.equal(core.detectType("   "), "blank");
  assert.equal(core.detectType("==="), "pagebreak");
  assert.equal(core.detectType("===="), "pagebreak");
  assert.equal(core.detectType("> CENTERED <"), "centered");
  assert.equal(core.detectType("# Act One"), "section");
  assert.equal(core.detectType("= a beat"), "synopsis");
  assert.equal(core.detectType("[[note]]"), "note");
});

/* ------------------------------------------------------------------ *
 * isCharacterName / isSceneHeading
 * ------------------------------------------------------------------ */

test("isCharacterName accepts typical cues", () => {
  assert.equal(core.isCharacterName("MARY"), true);
  assert.equal(core.isCharacterName("DR. SMITH"), true);
  assert.equal(core.isCharacterName("MARY-JANE"), true);
  assert.equal(core.isCharacterName("O'BRIEN"), true);
});

test("isCharacterName rejects non-cues", () => {
  assert.equal(core.isCharacterName("mary"), false);
  assert.equal(core.isCharacterName(""), false);
  assert.equal(core.isCharacterName("She walks across the room."), false);
});

test("isSceneHeading requires a location and time of day", () => {
  assert.equal(core.isSceneHeading("INT. HOUSE - DAY"), true);
  assert.equal(core.isSceneHeading("EXT. PARK - NIGHT"), true);
  assert.equal(core.isSceneHeading("INT. HOUSE"), false);
});

/* ------------------------------------------------------------------ *
 * validateDraft
 * ------------------------------------------------------------------ */

test("validateDraft rejects non-objects", () => {
  assert.throws(() => core.validateDraft(null), /object/);
  assert.throws(() => core.validateDraft([]), /object/);
  assert.throws(() => core.validateDraft("string"), /object/);
});

test("validateDraft requires a text field", () => {
  assert.throws(() => core.validateDraft({ title: "x" }), /text/);
});

test("validateDraft fills defaults", () => {
  const d = core.validateDraft({ text: "INT. ROOM - DAY" });
  assert.equal(d.text, "INT. ROOM - DAY");
  assert.equal(d.title, "Untitled");
  assert.deepEqual(d.lines, []);
  assert.deepEqual(d.characters, []);
  assert.deepEqual(d.scenes, []);
});

test("validateDraft preserves provided fields", () => {
  const d = core.validateDraft({
    text: "x",
    title: "My Script",
    characters: ["A"],
    scenes: ["INT. X - DAY"]
  });
  assert.equal(d.title, "My Script");
  assert.deepEqual(d.characters, ["A"]);
  assert.deepEqual(d.scenes, ["INT. X - DAY"]);
});

test("validateDraft enforces a byte ceiling", () => {
  const big = "a".repeat(2048);
  assert.throws(() => core.validateDraft({ text: big }, 1024), /too large/);
  // Under the limit should pass
  assert.doesNotThrow(() => core.validateDraft({ text: "short" }, 1024));
});

/* ------------------------------------------------------------------ *
 * fountainToMarkdown
 * ------------------------------------------------------------------ */

test("fountainToMarkdown promotes slugs, characters, and transitions", () => {
  const src = [
    "INT. HOUSE - DAY",
    "",
    "She enters.",
    "",
    "MARY",
    "Hello.",
    "",
    "> CUT TO:"
  ].join("\n");

  const md = core.fountainToMarkdown(src);
  assert.match(md, /^## INT\. HOUSE - DAY$/m);
  assert.match(md, /^### MARY$/m);
  assert.match(md, /^\*\*CUT TO:\*\*$/m);
  assert.match(md, /^She enters\.$/m);
});

test("fountainToMarkdown preserves section headings", () => {
  const md = core.fountainToMarkdown("# Act One\n\nINT. X - DAY");
  assert.match(md, /^# Act One$/m);
  assert.match(md, /^## INT\. X - DAY$/m);
});

/* ------------------------------------------------------------------ *
 * getScriptStats
 * ------------------------------------------------------------------ */

test("getScriptStats handles an empty script", () => {
  const s = core.getScriptStats("");
  assert.equal(s.words, 0);
  assert.equal(s.pages, 1);
  assert.equal(s.minutes, 1);
});

test("getScriptStats counts words and pages", () => {
  const src = Array.from({ length: 500 }, (_, i) => `word${i}`).join(" ");
  const s = core.getScriptStats(src);
  assert.equal(s.words, 500);
  assert.equal(s.pages, 2);
  assert.equal(s.minutes, 3);
});

/* ------------------------------------------------------------------ *
 * normalizeLibrary
 * ------------------------------------------------------------------ */

test("normalizeLibrary dedupes, uppercases, and sorts", () => {
  const out = core.normalizeLibrary({
    characters: ["mary", "MARY", "john", ""],
    scenes: ["int. house - day", "INT. HOUSE - DAY"]
  });
  assert.deepEqual(out.characters, ["JOHN", "MARY"]);
  assert.deepEqual(out.scenes, ["INT. HOUSE - DAY"]);
});

test("normalizeLibrary tolerates missing arrays", () => {
  const out = core.normalizeLibrary({});
  assert.deepEqual(out.characters, []);
  assert.deepEqual(out.scenes, []);
});

/* ------------------------------------------------------------------ *
 * compareVersions
 * ------------------------------------------------------------------ */

test("compareVersions returns 0 for equal versions", () => {
  assert.equal(core.compareVersions("1.0.11", "1.0.11"), 0);
  assert.equal(core.compareVersions("v1.0.11", "1.0.11"), 0);
  assert.equal(core.compareVersions("1.0", "1.0.0"), 0);
});

test("compareVersions returns 1 when the first is newer", () => {
  assert.equal(core.compareVersions("1.0.11", "1.0.10"), 1);
  assert.equal(core.compareVersions("1.0.10", "1.0.9"), 1);
  assert.equal(core.compareVersions("2.0.0", "1.99.99"), 1);
});

test("compareVersions returns -1 when the first is older", () => {
  assert.equal(core.compareVersions("1.0.9", "1.0.10"), -1);
  assert.equal(core.compareVersions("1.0.11", "2.0.0"), -1);
});

test("compareVersions strips pre-release suffixes", () => {
  assert.equal(core.compareVersions("1.0.11-beta.1", "1.0.11"), 0);
  assert.equal(core.compareVersions("1.1.0-rc.1", "1.0.11"), 1);
});