"use strict";

(function(){
  function cleanList(values, uppercase){
    return Array.from(new Set((Array.isArray(values) ? values : [])
      .filter(value => typeof value === "string")
      .map(value => value.trim())
      .filter(Boolean)
      .map(value => uppercase ? value.toUpperCase() : value)))
      .sort((a, b) => a.localeCompare(b));
  }

  function normalizeLibrary(store){
    return {
      ...store,
      characters: cleanList(store && store.characters, true),
      scenes: cleanList(store && store.scenes, true)
    };
  }

  function isCharacterName(value){
   return /^[A-Z][A-Z0-9 .'-]{1,41}$/.test(String(value || "").trim());
  }

  function isSceneHeading(value){
    return /^(INT|EXT|EST|INT\.?\/EXT|EXT\.?\/INT|I\/E)\.?\s+.+\s+-\s+\S+/i.test(String(value || "").trim());
  }

  function normalizeFountainText(value){
    return String(value == null ? "" : value).replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n");
  }

  function validateDraft(value, maxBytes){
    const limit = Number(maxBytes) || 10 * 1024 * 1024;
    if(!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Draft must be an object");
    if(typeof value.text !== "string") throw new Error("Draft text is required");
    if(new TextEncoder().encode(value.text).length > limit) throw new Error("Draft is too large");
    if(value.lines !== undefined && (!Array.isArray(value.lines) || value.lines.some(line => !line || typeof line.text !== "string"))){
      throw new Error("Draft lines are invalid");
    }
    if(value.title !== undefined && typeof value.title !== "string") throw new Error("Draft title is invalid");
    return {
      ...value,
      title: value.title || "Untitled",
      lines: Array.isArray(value.lines) ? value.lines : [],
      characters: Array.isArray(value.characters) ? value.characters : [],
      scenes: Array.isArray(value.scenes) ? value.scenes : []
    };
  }

  function getScriptStats(text){
    const source = normalizeFountainText(text).trim();
    const words = source ? source.split(/\s+/).length : 0;
    const pages = Math.max(1, Math.ceil(words / 250));
    return { words, pages, minutes: Math.max(1, Math.round(words / 180)) };
  }

  function fountainToMarkdown(text){
    return normalizeFountainText(text).split("\n").map(line => {
      const value = line.trim();
      if(!value) return "";
      if(/^#{1,6}\s/.test(value)) return value;
      if(/^(INT|EXT|EST|I\/E)\.?\s/i.test(value)) return "## " + value;
      if(/^>\s?/.test(value)) return "**" + value.replace(/^>\s?/, "") + "**";
      if(/^\(.*\)$/.test(value)) return "*" + value + "*";
      if(/^[A-Z][A-Z0-9 .'-]{1,47}$/.test(value)) return "### " + value;
      return value;
    }).join("\n");
  }
  
  function detectType(text){
    const t = String(text || "").trim();
    if(!t) return "blank";
    if(/^={3,}$/.test(t)) return "pagebreak";
    if(/^#{1,6}\s/.test(t)) return "section";
    if(/^=/.test(t)) return "synopsis";
    if(t.startsWith("[[")) return "note";
    if(t.startsWith("!")) return "action";
    if(t.startsWith(">")) return t.endsWith("<") ? "centered" : "transition";
    if(t.startsWith(".") && !t.startsWith("..")) return "scene";
    if(t.startsWith("@")) return "character";
    if(isSceneHeading(t) || /^(INT|EXT|EST|INT\.?\/EXT|EXT\.?\/INT|I\/E)[.\s]/i.test(t)) return "scene";
    if(/^\(.*\)$/.test(t) && t.length < 90) return "paren";
    const isCaps = t === t.toUpperCase() && /[A-Z]/.test(t) && !/[a-z]/.test(t);
    if(isCaps && t.length <= 48){
      if(/^(FADE\s*(IN|OUT|TO)?|CUT\s+TO|SMASH\s+CUT|MATCH\s+CUT|JUMP\s+CUT|DISSOLVE\s+TO|WIPE\s+TO|IRIS\s+(IN|OUT)|INTERCUT|BACK\s+TO|TIME\s+CUT|HARD\s+CUT)/i.test(t) || /TO:\s*$/.test(t) || t.endsWith(":")) return "transition";
      return "character";
    }
    if(/^(FADE\s*(IN|OUT|TO)?|CUT\s+TO|SMASH\s+CUT|MATCH\s+CUT|JUMP\s+CUT|DISSOLVE\s+TO|WIPE\s+TO|IRIS\s+(IN|OUT)|INTERCUT|BACK\s+TO|TIME\s+CUT|HARD\s+CUT)/i.test(t) || /TO:\s*$/.test(t)) return "transition";
    return "action";
  }
function compareVersions(a, b){
  const strip = v => String(v || "")
    .trim()
    .replace(/^v/i, "")
    .split("-")[0];                     // drop pre-release suffix
  const toParts = v => strip(v).split(".").map(n => {
    const i = parseInt(n, 10);
    return Number.isFinite(i) ? i : 0;
  });

  const pa = toParts(a);
  const pb = toParts(b);
  const len = Math.max(pa.length, pb.length);

  for(let i = 0; i < len; i++){
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if(x > y) return 1;
    if(x < y) return -1;
  }
  return 0;
}
  const api = { cleanList, normalizeLibrary, isCharacterName, isSceneHeading, detectType,
    normalizeFountainText, validateDraft, getScriptStats, fountainToMarkdown, compareVersions };
  if(typeof window !== "undefined") window.ScreenplayCore = api;
  if(typeof module !== "undefined" && module.exports) module.exports = api;
})();
