"use strict";
const APP_VERSION = "1.0.11";
/* ============================================================
  Hiiscript — a single-file offline Fountain screenwriter
   ============================================================ */

const $ = (s) => document.querySelector(s);
const editorEl    = $("#editor");
const preview     = $("#preview");
const titleInput  = $("#docTitle");
const docSelect   = $("#docSelect");
const statusEl    = $("#status");
const mainEl      = $("#main");
const autoBox     = $("#autoBox");
const templateNotice = $("#templateNotice");
const updateNotice = $("#updateNotice");
const headerEl = document.querySelector("header");
const statsEl      = $("#stats");
const MAX_DRAFT_BYTES = 10 * 1024 * 1024;

/* ================= utilities ================= */

function uid(){ return Math.random().toString(36).slice(2,10); }
function esc(s){ return String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function setStatus(msg){ statusEl.textContent = msg; clearTimeout(setStatus._t);
  setStatus._t = setTimeout(()=>{ statusEl.textContent=""; }, 2600); }
function download(name, text, mime){
  const blob = new Blob([text], {type: mime || "text/plain;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
}

/* ================= classification ================= */

const SCENE_RE = /^(INT|EXT|EST|INT\.?\/EXT|EXT\.?\/INT|I\/E)[.\s]/i;
const TRANS_START_RE = /^(FADE\s*(IN|OUT|TO)?|CUT\s+TO|SMASH\s+CUT|MATCH\s+CUT|JUMP\s+CUT|DISSOLVE\s+TO|WIPE\s+TO|IRIS\s+(IN|OUT)|INTERCUT|BACK\s+TO|TIME\s+CUT|HARD\s+CUT)/i;
const detectType = ScreenplayCore.detectType;

/* ================= store ================= */


let saveTimer = null;
let dirty = false;
let history = [];
let historyIndex = -1;
let applyingHistory = false;
const STARTER_TEMPLATE = `Title: The Last Signal
Credit: Written by
Author: Hiiscript Template
Draft date: 2026-09-17

INT. CITY ROOFTOP - NIGHT

Rain needles the skyline. A tiny red warning light blinks on a forgotten radio tower.

NOVA, 24, wearing a battered silver helmet, climbs over the ledge. Her cape is stitched from an old emergency blanket.

                         NOVA
             Please tell me that is not the
             city's entire power grid.

The radio crackles.

                         RADIO VOICE
             Ninety seconds until total blackout.

Nova looks down. Ten thousand windows glow beneath her.

                         NOVA
                 (to herself)
             Then I have ninety seconds.

A SHADOW leaps across the neighboring roof.

                         VEX
             You always did make dramatic entrances.

VEX, a masked thief with a stolen battery pack, steps into the rain.

                         NOVA
             Give me the battery, Vex.

                         VEX
             And let the city go dark? I would
             never miss an opportunity like that.

Vex hurls a bolt of blue energy. Nova catches it in her gloved hand. The glove sparks.

                         NOVA
             You changed the frequency.

                         VEX
             I learned from watching you.

Nova slams the energy into the radio tower. The warning light turns green.

                         RADIO VOICE
             Grid restored.

Below, the city comes alive again.

                         VEX
             So... dinner?

                         NOVA
             You are buying.

They disappear into the rain as the sun rises behind the towers.

FADE OUT.

> THE END <`;

function makeDoc(title, text){
  return { id: uid(), title: title || "Untitled", text: text || "", updated: Date.now() };
}

const LEGACY_KEY = "kabrownie.screen.v1";
const LEGACY_RECOVERY_KEY = "kabrownie.screen.recovery.v1";
const STORE_KEY = "main";
const RECOVERY_IDB_KEY = "recovery";

function defaultStore(){
  const d = makeDoc("The Last Signal — Template", STARTER_TEMPLATE);
  return {
    docs: [d],
    active: d.id,
    characters: ["NOVA", "VEX", "RADIO VOICE"],
    scenes: ["INT. CITY ROOFTOP - NIGHT"],
    firstRun: true,
    updateChecks: false
    ,
   layout: "editor"
  };
}

let store = defaultStore();
let persistTimer = null;

async function migrateFromLocalStorage(){
  const legacy = localStorage.getItem(LEGACY_KEY);
  const legacyRecovery = localStorage.getItem(LEGACY_RECOVERY_KEY);
  if(legacy){
    try{
      await HiiscriptStorage.set(STORE_KEY, JSON.parse(legacy));
      localStorage.removeItem(LEGACY_KEY);
    }catch(e){ /* corrupted: leave it */ }
  }
  if(legacyRecovery){
    try{
      await HiiscriptStorage.set(RECOVERY_IDB_KEY, JSON.parse(legacyRecovery));
      localStorage.removeItem(LEGACY_RECOVERY_KEY);
    }catch(e){}
  }
}

async function loadStore(){
  await migrateFromLocalStorage();
  const raw = await HiiscriptStorage.get(STORE_KEY);
  if(raw && Array.isArray(raw.docs) && raw.docs.length){
    store = ScreenplayCore.normalizeLibrary(raw);
  } else {
    store = defaultStore();
    await HiiscriptStorage.set(STORE_KEY, store);
  }
}

function persist(){
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    HiiscriptStorage.set(STORE_KEY, store).catch(e => {
      console.error("persist failed", e);
      setStatus("⚠ could not save — export a backup");
    });
  }, 250);
}

async function persistNow(){
  clearTimeout(persistTimer);
  try{
    await HiiscriptStorage.set(STORE_KEY, store);
  }catch(e){
    console.error("persist failed", e);
    setStatus("⚠ could not save — export a backup");
  }
}

function setSaveState(saved){
  dirty = !saved;
  statusEl.textContent = saved ? "Saved" : "Unsaved changes";
  statusEl.classList.toggle("saved", saved);
  statusEl.classList.toggle("dirty", !saved);
}

async function writeRecoverySnapshot(){
  const d = activeDoc();
  if(!d) return;
  const text = serialize();
  if(new TextEncoder().encode(text).length > MAX_DRAFT_BYTES) return;
  try{
    await HiiscriptStorage.set(RECOVERY_IDB_KEY, {
      version: 1,
      id: d.id,
      title: titleInput.value.trim() || "Untitled",
      text,
      updated: Date.now()
    });
  }catch(e){
    console.error("recovery snapshot failed", e);
  }
}

async function clearRecoverySnapshot(){
  try{ await HiiscriptStorage.del(RECOVERY_IDB_KEY); }catch(e){}
}

async function recoverySnapshot(){
  try{
    const value = await HiiscriptStorage.get(RECOVERY_IDB_KEY);
    if(!value) return null;
    return ScreenplayCore.validateDraft(value, MAX_DRAFT_BYTES);
  }catch(e){
    return null;
  }
}
function activeDoc(){
  return store.docs.find(d => d.id === store.active) || store.docs[0];
}

function refreshDocList(){
  docSelect.innerHTML = store.docs
    .map(d => `<option value="${d.id}">${esc(d.title || "Untitled")}</option>`)
    .join("");
  docSelect.value = store.active;
}

function rememberCharacters(){
  if(!Array.isArray(store.characters)) store.characters = [];
  const known = new Set(store.characters);
  let changed = false;
  getLines().forEach(line => {
    const name = line.textContent.trim().replace(/\^$/, "");
    const next = line.nextElementSibling;
    const nextType = next && next.dataset.type;
    const valid = line.dataset.type === "character" &&
      ScreenplayCore.isCharacterName(name) &&
      (line.dataset.force === "character" || nextType === "dialog" || nextType === "paren");
    if(valid && !known.has(name)){
      known.add(name);
      store.characters.push(name);
      changed = true;
    }
  });
  if(changed) store.characters.sort((a,b) => a.localeCompare(b));
  return changed;
}

function rememberScenes(){
  if(!Array.isArray(store.scenes)) store.scenes = [];
  const known = new Set(store.scenes);
  let changed = false;
  getLines().forEach(line => {
    const scene = line.textContent.trim();
    const valid = line.dataset.type === "scene" && ScreenplayCore.isSceneHeading(scene);
    if(valid && !known.has(scene)){
      known.add(scene);
      store.scenes.push(scene);
      changed = true;
    }
  });
  if(changed) store.scenes.sort((a,b) => a.localeCompare(b));
  return changed;
}

/* ================= editor: line model ================= */

function getLines(){
  return Array.from(editorEl.children).filter(
    el => el.nodeType === 1 && el.hasAttribute("data-type")
  );
}

function newLine(text, type){
  const d = document.createElement("div");
  d.className = "ln";
  d.setAttribute("data-type", type || "action");
  d.textContent = text || "";
  return d;
}

function applyType(line, type){
  if(!line) return;
  if(line.getAttribute("data-type") !== type) line.setAttribute("data-type", type);
}

function reclassify(line){
  if(!line) return;
  const force = line.dataset.force;
  const text = line.textContent;
  let type = force;
  if(!type){
    type = detectType(text);
  } else {
    const det = detectType(text);
    if(det === force) { delete line.dataset.force; type = det; }
  }
  applyType(line, type);
}

function reclassifyAround(line){
  reclassify(line);
  const prev = line.previousElementSibling;
  if(prev && prev.hasAttribute("data-type")) reclassify(prev);
  const next = line.nextElementSibling;
  if(next && next.hasAttribute("data-type")) reclassify(next);
}

function reclassifyAll(){
  getLines().forEach(l => {
    const force = l.dataset.force;
    const type = force || detectType(l.textContent);
    applyType(l, type);
  });
}

/* --- marker stripping / serialization --- */

function stripMarker(line){
  const t = line.textContent;
  let force = null, text = t;
  if(/^>\s?/.test(t) && /\s?<$/.test(t)){
    force = "centered"; text = t.replace(/^>\s?/, "").replace(/\s?<$/, "");
  } else if(/^>/.test(t)){
    force = "transition"; text = t.replace(/^>\s?/, "");
  } else if(/^\.\s?/.test(t) && !/^\.\./.test(t)){
    force = "scene"; text = t.replace(/^\.\s?/, "");
  } else if(/^@/.test(t)){
    force = "character"; text = t.slice(1);
  } else if(/^!/.test(t)){
    force = "action"; text = t.slice(1);
  }
  if(force){ line.textContent = text; line.dataset.force = force; }
  else { delete line.dataset.force; }
}

function serializeLine(line){
  const text = line.textContent;
  const force = line.dataset.force;
  if(!force) return text;
  const det = detectType(text);
  if(det === force) return text;
  switch(force){
    case "scene":      return ". " + text;
    case "character":  return "@" + text;
    case "transition": return "> " + text;
    case "action":     return "!" + text;
    case "centered":   return "> " + text + " <";
    default:           return text;
  }
}

function serialize(){
  return getLines().map(serializeLine).join("\n");
}

function loadIntoEditor(text){
  editorEl.innerHTML = "";
  const lines = String(text == null ? "" : text).replace(/\r\n?/g, "\n").split("\n");
  if(!lines.length) lines.push("");
  lines.forEach(t => {
    const l = newLine("", "action");
    l.textContent = t;
    editorEl.appendChild(l);
  });
  getLines().forEach(stripMarker);
  reclassifyAll();
}

function loadDraftLines(lines){
  editorEl.innerHTML = "";
  for(const item of lines){
    const line = newLine(item.text || "", item.type || "action");
    if(item.force) line.dataset.force = item.force;
    editorEl.appendChild(line);
  }
  ensureEditor();
}

function ensureEditor(){
  if(!getLines().length) editorEl.appendChild(newLine("", "action"));
}

/* ================= caret helpers ================= */

function getCurrentLine(){
  const sel = window.getSelection();
  if(!sel.rangeCount) return null;
  let node = sel.anchorNode;
  if(!node) return null;
  if(node === editorEl) return null;
  while(node && node !== editorEl){
    if(node.nodeType === 1 && node.hasAttribute && node.hasAttribute("data-type")) return node;
    node = node.parentNode;
  }
  return null;
}

function caretOffsetInLine(line){
  const sel = window.getSelection();
  if(!sel.rangeCount || !line) return 0;
  const range = sel.getRangeAt(0);
  if(!line.contains(range.endContainer) && range.endContainer !== line) return (line.textContent||"").length;
  const pre = range.cloneRange();
  pre.selectNodeContents(line);
  try{ pre.setEnd(range.endContainer, range.endOffset); }catch(e){ return (line.textContent||"").length; }
  return pre.toString().length;
}

function setCaret(line, offset){
  if(!line) return;
  const range = document.createRange();
  let remaining = Math.max(0, offset|0);
  let found = false;
  (function walk(node){
    if(found) return;
    if(node.nodeType === 3){
      if(remaining <= node.length){
        try{ range.setStart(node, remaining); }catch(e){ range.setStart(node, node.length); }
        range.collapse(true); found = true;
      } else remaining -= node.length;
    } else if(node.nodeType === 1){
      if(node.tagName === "BR"){
        if(remaining === 0){ range.setStartBefore(node); range.collapse(true); found = true; return; }
        remaining -= 1;
        if(remaining <= 0){ range.setStartAfter(node); range.collapse(true); found = true; return; }
      }
      for(const c of node.childNodes) walk(c);
    }
  })(line);
  if(!found){
    range.selectNodeContents(line);
    range.collapse(false);
  }
  const sel = window.getSelection();
  sel.removeAllRanges(); sel.addRange(range);
}

/* ================= render + save ================= */

let renderQueued = false;
let lastBlocks = [];

function queueRender(){
  if(renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; render(); });
}

function render(){
  const src = serialize();
  const scriptStats = ScreenplayCore.getScriptStats(src);
  statsEl.textContent = `${scriptStats.words} words · ${scriptStats.pages} page${scriptStats.pages === 1 ? "" : "s"} · ~${scriptStats.minutes} min`;
  const { titlePage, blocks } = parseFountain(src);
  lastBlocks = blocks;
  const pages = [];
  let pageBlocks = [];
  for(const block of blocks){
    if(block.type === "pagebreak"){
      pages.push(pageBlocks);
      pageBlocks = [];
    } else {
      pageBlocks.push(block);
    }
  }
  if(pageBlocks.length || !pages.length) pages.push(pageBlocks);
  let html = titlePage ? `<div class="pageSheet"><div class="page">${renderTitlePage(titlePage)}</div></div>` : "";
  html += pages.map(page => `<div class="pageSheet"><div class="page">${page.map(renderBlock).join("")}</div></div>`).join("");
  preview.innerHTML = html || `<div class="page"><p class="action" style="color:#c9a">Nothing yet — start typing.</p></div>`;
  requestAnimationFrame(paginatePreview);
}

function paginatePreview(){
  let sheets = Array.from(preview.children).filter(el => el.classList.contains("pageSheet"));
  for(let index = 0; index < sheets.length; index++){
    const sheet = sheets[index];
    const page = sheet.querySelector(".page");
    if(!page) continue;
    if(page.querySelector(".titlepage")) continue;
    while(page.scrollHeight > sheet.clientHeight + 1 && page.children.length > 1){
      let nextSheet = sheets[index + 1];
      if(!nextSheet){
        nextSheet = document.createElement("div");
        nextSheet.className = "pageSheet";
        const nextPage = document.createElement("div");
        nextPage.className = "page";
        nextSheet.append(nextPage);
        sheet.parentNode.insertBefore(nextSheet, sheet.nextSibling);
        sheets = sheets.slice();
        sheets.splice(index + 1, 0, nextSheet);
      }
      const nextPage = nextSheet.querySelector(".page");
      nextPage.prepend(page.lastElementChild);
    }
  }
}

function scheduleSave(){
  dirty = true;
  setSaveState(false);
  writeRecoverySnapshot();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { flush(); refreshDocList(); setStatus("Saved"); }, 500);
}

function flush(){
  clearTimeout(saveTimer);
  const d = activeDoc();
  if(!d) return;
  d.text = serialize();
  d.title = (titleInput.value.trim() || "Untitled");
  d.updated = Date.now();
  rememberCharacters();
  rememberScenes();
  persistNow();
  clearRecoverySnapshot();
  setSaveState(true);
}

function captureHistory(){
  if(applyingHistory) return;
  const snapshot = { text: serialize(), title: titleInput.value };
  const current = history[historyIndex];
  if(current && current.text === snapshot.text && current.title === snapshot.title) return;
  history = history.slice(0, historyIndex + 1);
  history.push(snapshot);
  if(history.length > 100) history.shift();
  historyIndex = history.length - 1;
  updateHistoryButtons();
}

function updateHistoryButtons(){
  $("#btnUndo").disabled = historyIndex <= 0;
  $("#btnRedo").disabled = historyIndex < 0 || historyIndex >= history.length - 1;
}

function restoreHistory(index){
  if(index < 0 || index >= history.length) return;
  applyingHistory = true;
  const snapshot = history[index];
  titleInput.value = snapshot.title;
  loadIntoEditor(snapshot.text);
  historyIndex = index;
  applyingHistory = false;
  render();
  scheduleSave();
  highlightActive();
  updateHistoryButtons();
}

function undo(){ restoreHistory(historyIndex - 1); }
function redo(){ restoreHistory(historyIndex + 1); }

function draftJson(){
  flush();
  const d = activeDoc();
  const lines = getLines().map(line => ({
    text: line.textContent,
    type: line.dataset.type || "action",
    ...(line.dataset.force ? {force: line.dataset.force} : {})
  }));
  return JSON.stringify({version:2, title:d.title, text:d.text, lines,
    characters: Array.isArray(store.characters) ? store.characters : [],
    scenes: Array.isArray(store.scenes) ? store.scenes : [],
    updated:d.updated}, null, 2);
}

async function saveDraftFile(format = $("#saveFormat").value){
  flush();
  const d = activeDoc();
  const safe = (d.title || "screenplay").replace(/[^\w\-. ]+/g, "").trim() || "screenplay";
  const files = {
    fountain: {name: safe + ".fountain", content: d.text, mime: "text/plain;charset=utf-8"},
    markdown: {name: safe + ".md", content: ScreenplayCore.fountainToMarkdown(d.text), mime: "text/markdown;charset=utf-8"},
    json: {name: safe + ".json", content: draftJson(), mime: "application/json;charset=utf-8"}
  };
  const file = files[format] || files.fountain;
  if(window.screenBridge && window.screenBridge.save){
    const result = await window.screenBridge.save(file.content, {name: file.name, extension: format, filterName: format === "json" ? "Project backup" : format === "markdown" ? "Markdown screenplay" : "Fountain screenplay"});
    if(!result.cancelled) setStatus("Saved " + file.name);
    return;
  }
  download(file.name, file.content, file.mime);
  setStatus("Downloaded " + file.name);
}

function loadDraftContent(content){
  const draft = ScreenplayCore.validateDraft(JSON.parse(content), MAX_DRAFT_BYTES);
  const d = makeDoc(draft.title || "Untitled");
  d.text = draft.text;
  d.updated = Number(draft.updated) || Date.now();
  store.docs.push(d);
  store.active = d.id;
  titleInput.value = d.title;
  if(Array.isArray(draft.lines) && draft.lines.length) loadDraftLines(draft.lines);
  else loadIntoEditor(d.text);
  if(Array.isArray(draft.characters)){
    store.characters = Array.from(new Set([...(store.characters || []), ...draft.characters]))
      .filter(name => typeof name === "string")
      .sort((a,b) => a.localeCompare(b));
  }
  if(Array.isArray(draft.scenes)){
    store.scenes = Array.from(new Set([...(store.scenes || []), ...draft.scenes]))
      .filter(scene => typeof scene === "string")
      .sort((a,b) => a.localeCompare(b));
  }
  rememberCharacters();
  rememberScenes();
  persist(); refreshDocList(); render(); highlightActive();
  clearRecoverySnapshot();
  setSaveState(true);
  history = [{text: d.text, title: d.title}]; historyIndex = 0; updateHistoryButtons();
  setStatus("Draft opened");
}

async function openDraftFile(){
  if(window.screenBridge && window.screenBridge.open){
    const result = await window.screenBridge.open();
    if(!result.cancelled){
      if(result.extension === "json") loadDraftContent(result.content);
      else loadPlainContent(result.content, result.filePath || "Imported");
    }
    return;
  }
  $("#draftInput").click();
}

function onEdit(){
  captureHistory();
  queueRender();
  scheduleSave();
  updateAuto();
  highlightActive();
}

function highlightActive(){
  const cur = getCurrentLine();
  getLines().forEach(l => l.classList.toggle("active", l === cur));
}

/* ================= Fountain parser ================= */

function isBlockStart(t){
  return /^={3,}$/.test(t) || /^#{1,6}\s/.test(t) || /^=/.test(t) ||
         t.startsWith("[[") || t.startsWith("!") || t.startsWith(">") ||
         (t.startsWith(".") && !t.startsWith("..")) || SCENE_RE.test(t);
}

function isCharacterLine(t, nextTrimmed){
  if(!nextTrimmed) return false;
  if(t.startsWith("@")) return true;
  let name = t.endsWith("^") ? t.slice(0,-1).trim() : t;
  if(!name || name.length > 42) return false;
  if(name !== name.toUpperCase()) return false;
  if(!/[A-Z]/.test(name)) return false;
  if(SCENE_RE.test(t)) return false;
  if(TRANS_START_RE.test(t)) return false;
  if(/TO:\s*$/.test(t)) return false;
  return true;
}

function parseFountain(src){
  const lines = String(src).replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let titlePage = null;
  let i = 0;

  /* title page */
  {
    let keys = 0, j = 0;
    while(j < lines.length){
      const l = lines[j];
      if(!l.trim()) break;
      if(/^[A-Za-z][A-Za-z0-9 _\-]*\s*:/.test(l)) keys++;
      else if(!/^\s{2,}/.test(l)) break;
      j++;
    }
    if(keys >= 2){ titlePage = lines.slice(0, j); i = j; }
  }

  const peek = (k) => (k < lines.length ? lines[k].trim() : "");

  while(i < lines.length){
    const t = lines[i].trim();
    if(!t){ i++; continue; }

    if(/^={3,}$/.test(t)){ blocks.push({type:"pagebreak"}); i++; continue; }

    let m;
    if((m = t.match(/^(#{1,6})\s*(.*)$/))){
      blocks.push({type:"section", depth:m[1].length, text:m[2]}); i++; continue;
    }
    if(/^=/.test(t)){ blocks.push({type:"synopsis", text:t.slice(1).trim()}); i++; continue; }

    if(t.startsWith("[[")){
      let note = t, closed = t.includes("]]");
      i++;
      while(!closed && i < lines.length){
        note += "\n" + lines[i];
        if(lines[i].includes("]]")) closed = true;
        i++;
      }
      blocks.push({type:"note", text: note.replace(/^\[\[/,"").replace(/\]\]$/,"").trim()});
      continue;
    }

    if(t.startsWith("!")){ blocks.push({type:"action", text:t.slice(1)}); i++; continue; }

    if(t.startsWith(">") && t.endsWith("<")){
      blocks.push({type:"centered", text:t.slice(1,-1).trim()}); i++; continue;
    }
    if(t.startsWith(">")){
      blocks.push({type:"transition", text:t.slice(1).trim()}); i++; continue;
    }
    if(t.startsWith(".") && !t.startsWith("..")){
      blocks.push({type:"scene", text:t.slice(1).trim()}); i++; continue;
    }
    if(SCENE_RE.test(t)){ blocks.push({type:"scene", text:t}); i++; continue; }

    if(t === t.toUpperCase() && /[A-Z]/.test(t) && t.length <= 48 &&
       (TRANS_START_RE.test(t) || /TO:\s*$/.test(t) || t.endsWith(":"))){
      blocks.push({type:"transition", text:t}); i++; continue;
    }

    if(isCharacterLine(t, peek(i+1))){
      let name = t.startsWith("@") ? t.slice(1) : t;
      let dual = false;
      if(name.endsWith("^")){ dual = true; name = name.slice(0,-1).trim(); }
      i++;
      const parts = [];
      while(i < lines.length && lines[i].trim() !== ""){
        const dl = lines[i].trim();
        if(/^\(.*\)$/.test(dl)) parts.push({type:"paren", text:dl});
        else                    parts.push({type:"line",  text:dl});
        i++;
      }
      blocks.push({type:"dialogue", character:name, parts, dual});
      continue;
    }

    const buf = [t];
    i++;
    while(i < lines.length){
      const nt = lines[i].trim();
      if(nt === "" || isBlockStart(nt)) break;
      buf.push(nt); i++;
    }
    blocks.push({type:"action", text: buf.join("\n")});
  }

  return { titlePage, blocks };
}

/* ================= render helpers ================= */

function inline(s){
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/\*(.+?)\*/g,     "<i>$1</i>")
    .replace(/_(.+?)_/g,       "<u>$1</u>");
}

function renderTitlePage(lines){
  const f = {};
  let cur = null;
  for(const l of lines){
    const m = l.match(/^([A-Za-z][A-Za-z0-9 _\-]*)\s*:\s*(.*)$/);
    if(m){ cur = m[1].toLowerCase().replace(/\s+/g,""); f[cur] = m[2].trim(); }
    else if(cur && l.trim()){ f[cur] += "\n" + l.trim(); }
  }
  const top = [];
  if(f.title)     top.push(`<p class="tp-title">${inline(f.title)}</p>`);
  if(f.credit)    top.push(`<p class="tp-credit">${inline(f.credit)}</p>`);
  if(f.author)    top.push(`<p class="tp-author">${inline(f.author)}</p>`);
  if(f.authors)   top.push(`<p class="tp-author">${inline(f.authors)}</p>`);
  if(f.source)    top.push(`<p class="tp-source">${inline(f.source)}</p>`);
  if(f.draftdate) top.push(`<p class="tp-draft">${inline(f.draftdate)}</p>`);
  const bottom = f.contact ? `<p class="tp-contact">${inline(f.contact)}</p>` : "";
  return `<div class="titlepage"><div class="tp-top">${top.join("")}</div>` +
         `<div class="tp-bottom">${bottom}</div></div>`;
}

function renderBlock(b){
  switch(b.type){
    case "scene":      return `<p class="scene">${inline(b.text)}</p>`;
    case "action":     return b.text.split("\n").map(line => `<p class="action">${inline(line)}</p>`).join("");
    case "transition": return `<p class="transition">${inline(b.text)}</p>`;
    case "centered":   return `<p class="centered">${inline(b.text)}</p>`;
    case "section":    return `<p class="section">${inline(b.text)}</p>`;
    case "synopsis":   return `<p class="synopsis">${inline(b.text)}</p>`;
    case "note":       return `<p class="note">${inline(b.text)}</p>`;
    case "pagebreak":  return `<div class="pagebreak"></div>`;
    case "dialogue": {
      const inner = b.parts.map(p =>
        p.type === "paren"
          ? `<p class="paren">${inline(p.text)}</p>`
          : `<p class="dialog">${inline(p.text)}</p>`
      ).join("");
      return `<div class="dialogblock"><p class="character">${inline(b.character)}</p>${inner}</div>`;
    }
  }
  return "";
}

/* ================= element cycling ================= */

const ORDER = ["action","scene","character","paren","dialog","transition"];

const TYPE_LABEL = {
  action:"Action", scene:"Scene Heading", character:"Character",
  paren:"Parenthetical", dialog:"Dialogue", transition:"Transition",
  centered:"Centered", blank:"Blank"
};

function cycleType(){
  const line = getCurrentLine();
  if(!line) return;
  const cur = line.getAttribute("data-type") || "action";
  let idx = ORDER.indexOf(cur);
  if(idx < 0) idx = 0;
  const next = ORDER[(idx + 1) % ORDER.length];
  const det = detectType(line.textContent);
  if(next === det) delete line.dataset.force;
  else line.dataset.force = next;
  applyType(line, next);
  onEdit();
  setStatus(TYPE_LABEL[next] || next);
}

function setType(type){
  const line = getCurrentLine();
  if(!line) return;
  const det = detectType(line.textContent);
  if(type === det) delete line.dataset.force;
  else line.dataset.force = type;
  applyType(line, type);
  onEdit();
  setStatus(TYPE_LABEL[type] || type);
}

/* ================= autocomplete ================= */

const TIMES = ["DAY","NIGHT","MORNING","AFTERNOON","EVENING","CONTINUOUS",
               "LATER","MOMENTS LATER","DAWN","DUSK","MAGIC HOUR","SAME TIME"];

const GENERAL = [
  "INT. ", "EXT. ", "INT./EXT. ", "EXT./INT. ", "I/E. ",
  "FADE IN:", "FADE OUT.", "FADE TO BLACK.", "FADE TO WHITE.",
  "CUT TO:", "CUT TO BLACK.", "SMASH CUT TO:", "MATCH CUT TO:",
  "JUMP CUT TO:", "DISSOLVE TO:", "WIPE TO:", "IRIS IN:", "IRIS OUT:",
  "INTERCUT WITH:", "BACK TO:", "TIME CUT:", "HARD CUT TO:"
];

let autoItems = [];
let autoSel = 0;

function hideAuto(){ autoBox.classList.remove("open"); autoItems = []; }

function showAuto(items, typedPrefix){
  autoItems = items; autoSel = 0;
  renderAuto(typedPrefix);
  autoBox.classList.add("open");
  positionAuto();
}

function renderAuto(typedPrefix){
  const up = (typedPrefix || "").toUpperCase();
  autoBox.innerHTML = autoItems.map((it, idx) => {
    let html;
    if(up && it.toUpperCase().startsWith(up)){
      html = `<span class="hl">${esc(it.slice(0, typedPrefix.length))}</span>${esc(it.slice(typedPrefix.length))}`;
    } else {
      html = esc(it);
    }
    return `<div class="item${idx===autoSel?" sel":""}" data-i="${idx}" id="auto-item-${idx}" role="option" aria-selected="${idx===autoSel}">${html}</div>`;
  }).join("") + `<div class="hint">Enter to accept · Esc to dismiss</div>`;
  autoBox.setAttribute("role", "listbox");
  autoBox.setAttribute("aria-label", "Suggestions");
  autoBox.setAttribute("aria-activedescendant", `auto-item-${autoSel}`);
  autoBox.querySelectorAll(".item").forEach(el => {
    el.addEventListener("mousedown", (e) => { e.preventDefault(); acceptAuto(autoItems[Number(el.dataset.i)]); });
    el.addEventListener("mouseenter", () => { autoSel = Number(el.dataset.i); renderAuto(typedPrefix); });
  });
}

function positionAuto(){
  const sel = window.getSelection();
  if(!sel.rangeCount) return;
  const range = sel.getRangeAt(0).cloneRange();
  range.collapse(false);
  let rect = range.getBoundingClientRect();
  if(!rect || (!rect.width && !rect.height)){
    const line = getCurrentLine();
    if(line) rect = line.getBoundingClientRect();
  }
  if(!rect) return;
  const boxH = autoBox.offsetHeight || 200;
  let top = rect.bottom + 6;
  if(top + boxH > window.innerHeight - 12) top = Math.max(8, rect.top - boxH - 6);
  let left = Math.min(rect.left, window.innerWidth - autoBox.offsetWidth - 14);
  autoBox.style.top = top + "px";
  autoBox.style.left = Math.max(8, left) + "px";
}

function getSuggestions(){
  const line = getCurrentLine();
  if(!line) return null;
  const text = line.textContent;
  const trimmed = text.trim();
  if(!trimmed) return null;

  /* --- scene heading: location / time-of-day --- */
  const sceneMatch = trimmed.match(/^((?:INT|EXT|EST|INT\.?\/EXT|EXT\.?\/INT|I\/E)\.?\s+)(.*)$/i);
  if(sceneMatch){
    const head = sceneMatch[1];
    const rest = sceneMatch[2];
    if(Array.isArray(store.scenes)){
      const up = trimmed.toUpperCase();
      const saved = store.scenes.filter(scene =>
        scene.toUpperCase().startsWith(up) && scene.length > trimmed.length
      );
      if(saved.length) return {items: saved.slice(0, 8), prefix: trimmed};
    }
    const timeMatch = rest.match(/^(.*?)\s+-\s*(.*)$/);
    if(timeMatch){
      const typedTime = timeMatch[2].toUpperCase();
      const loc = timeMatch[1].replace(/\s+$/,"");
      const matches = TIMES.filter(t => t.startsWith(typedTime) && t.length > typedTime.length);
      if(matches.length){
        return { items: matches.map(t => head + loc + " - " + t), prefix: timeMatch[2] };
      }
      return null;
    }
    if(/\s-\s*$/.test(rest)){
      const loc = rest.replace(/\s*-\s*$/,"");
      return { items: TIMES.map(t => head + loc + " - " + t), prefix: "" };
    }
    if(rest.length > 1){
      return { items: TIMES.slice(0,8).map(t => head + rest + " - " + t), prefix: "" };
    }
    return null;
  }

  /* --- saved character names --- */
  if(/^[A-Z][A-Z0-9 .'-]*$/i.test(trimmed) && Array.isArray(store.characters)){
    const up = trimmed.toUpperCase();
    const matches = store.characters.filter(name =>
      name.toUpperCase().startsWith(up) && name.length > trimmed.length
    );
    if(matches.length) return {items: matches.slice(0, 8), prefix: trimmed};
  }

  /* --- transitions / scene starts --- */
  if(/^[A-Z0-9. \/]+$/.test(trimmed) && trimmed.length >= 1){
    const up = trimmed.toUpperCase();
    const matches = GENERAL.filter(g => g.toUpperCase().startsWith(up) && g.length > trimmed.length);
    if(matches.length) return { items: matches.slice(0,7), prefix: trimmed };
  }

  return null;
}

function updateAuto(){
  const sel = window.getSelection();
  if(!sel.rangeCount){ hideAuto(); return; }
  const line = getCurrentLine();
  if(!line){ hideAuto(); return; }
  const text = line.textContent;
  const off = caretOffsetInLine(line);
  if(off !== text.length){ hideAuto(); return; }
  const sug = getSuggestions();
  if(!sug || !sug.items.length){ hideAuto(); return; }
  showAuto(sug.items, sug.prefix);
}

function acceptAuto(item){
  const line = getCurrentLine();
  if(!line) return;
  const text = line.textContent;
  const trimmed = text.trim();
  const lead = text.slice(0, text.length - text.replace(/^\s+/,"").length);
  let newText;

  if(item.startsWith(" - ")){
    /* replace existing time portion if present */
    const base = trimmed.split(/\s+-\s+/)[0].replace(/\s*-\s*$/,"");
    newText = lead + base + item;
  } else {
    newText = lead + item;
  }
  line.textContent = newText;
  delete line.dataset.force;
  setCaret(line, newText.length);
  hideAuto();
  reclassifyAround(line);
  onEdit();
}

/* ================= editor events ================= */

editorEl.addEventListener("input", () => {
  const line = getCurrentLine();
  if(line) reclassifyAround(line);
  onEdit();
});

editorEl.addEventListener("keydown", (e) => {
  const mod = e.metaKey || e.ctrlKey;

  /* autocomplete navigation */
  if(autoBox.classList.contains("open")){
    if(e.key === "Escape"){ e.preventDefault(); hideAuto(); return; }
    if(e.key === "ArrowDown"){ e.preventDefault(); autoSel = (autoSel+1)%autoItems.length; renderAuto(getSuggestions()?.prefix||""); return; }
    if(e.key === "ArrowUp"){ e.preventDefault(); autoSel = (autoSel-1+autoItems.length)%autoItems.length; renderAuto(getSuggestions()?.prefix||""); return; }
    if(e.key === "Enter" || e.key === "Tab"){ e.preventDefault(); acceptAuto(autoItems[autoSel]); return; }
  }

  if(e.key === "Tab"){
    e.preventDefault();
    cycleType();
    return;
  }

  if(mod && e.key >= "1" && e.key <= "6"){
    e.preventDefault();
    setType(ORDER[Number(e.key)-1]);
    return;
  }

  if(mod && e.key.toLowerCase() === "s"){
    e.preventDefault();
    flush(); refreshDocList(); setStatus("Saved");
    return;
  }

  if(mod && (e.key.toLowerCase() === "b" || e.key.toLowerCase() === "i" || e.key.toLowerCase() === "u")){
    e.preventDefault();
    const wrap = e.key.toLowerCase() === "b" ? "**" : e.key.toLowerCase() === "i" ? "*" : "_";
    insertPlain(wrap + wrap);
    const sel = window.getSelection();
    if(sel.rangeCount){
      const r = sel.getRangeAt(0);
      if(r.startContainer && r.startContainer.nodeType === 3 && r.startOffset >= wrap.length){
        try{
          const nr = document.createRange();
          nr.setStart(r.startContainer, r.startOffset - wrap.length);
          nr.setEnd(r.startContainer, r.startOffset - wrap.length);
          sel.removeAllRanges(); sel.addRange(nr);
        }catch(err){}
      }
    }
    return;
  }

  /* Enter -> new line with smart next type */
  if(e.key === "Enter"){
    e.preventDefault();
    const line = getCurrentLine();
    if(!line){
      ensureEditor();
      const l = getLines()[0];
      setCaret(l, 0);
      return;
    }
    const off = caretOffsetInLine(line);
    const text = line.textContent;
    const before = text.slice(0, off);
    const after  = text.slice(off);
    const curType = line.getAttribute("data-type") || "action";

    line.textContent = before;
    const nl = newLine(after, "action");
    line.parentNode.insertBefore(nl, line.nextSibling);

    reclassifyAround(line);

    let nextType = "action";
    switch(curType){
      case "scene":      nextType = "action"; break;
      case "character":  nextType = "dialog"; break;
      case "paren":      nextType = "dialog"; break;
      case "dialog":     nextType = "action"; break;
      case "transition": nextType = "scene";  break;
      default:           nextType = "action";
    }
    /* blank current line ending dialogue -> action */
    if(curType === "dialog" && !after.trim()) nextType = "action";
    nl.setAttribute("data-type", nextType);
    if(nextType === "character" || nextType === "scene") nl.dataset.force = nextType;

    setCaret(nl, 0);
    onEdit();
    return;
  }

  /* Backspace at start of line -> merge with previous */
  if(e.key === "Backspace"){
    const line = getCurrentLine();
    if(!line) return;
    const off = caretOffsetInLine(line);
    if(off === 0){
      const prev = line.previousElementSibling;
      if(prev && prev.hasAttribute("data-type")){
        e.preventDefault();
        const prevLen = (prev.textContent||"").length;
        prev.textContent = (prev.textContent||"") + (line.textContent||"");
        line.remove();
        setCaret(prev, prevLen);
        reclassifyAround(prev);
        onEdit();
      }
    }
    return;
  }

  /* Arrow up/down across lines */
  if(e.key === "ArrowUp" && !e.shiftKey){
    const line = getCurrentLine();
    const prev = line && line.previousElementSibling;
    if(prev && prev.hasAttribute("data-type")){
      e.preventDefault();
      const off = Math.min(caretOffsetInLine(line), (prev.textContent||"").length);
      setCaret(prev, off);
      highlightActive();
    }
    return;
  }
  if(e.key === "ArrowDown" && !e.shiftKey){
    const line = getCurrentLine();
    const next = line && line.nextElementSibling;
    if(next && next.hasAttribute("data-type")){
      e.preventDefault();
      const off = Math.min(caretOffsetInLine(line), (next.textContent||"").length);
      setCaret(next, off);
      highlightActive();
    }
    return;
  }
});

/* plain-text paste */
editorEl.addEventListener("paste", (e) => {
  e.preventDefault();
  const cd = e.clipboardData || window.clipboardData;
  const text = cd ? cd.getData("text/plain") : "";
  if(!text) return;
  const line = getCurrentLine();
  if(!line){ ensureEditor(); }

  const parts = text.replace(/\r\n?/g, "\n").split("\n");
  const off = caretOffsetInLine(line);
  const cur = line.textContent;
  const before = cur.slice(0, off);
  const after  = cur.slice(off);

  if(parts.length === 1){
    line.textContent = before + parts[0] + after;
    delete line.dataset.force;
    setCaret(line, before.length + parts[0].length);
    reclassifyAround(line);
    onEdit();
    return;
  }

  line.textContent = before + parts[0];
  delete line.dataset.force;
  let ref = line;
  for(let i = 1; i < parts.length; i++){
    const isLast = i === parts.length - 1;
    const nl = newLine(parts[i] + (isLast ? after : ""), "action");
    ref.parentNode.insertBefore(nl, ref.nextSibling);
    ref = nl;
  }
  reclassifyAll();
  setCaret(ref, (parts[parts.length-1]||"").length);
  onEdit();
});

editorEl.addEventListener("mouseup", highlightActive);
editorEl.addEventListener("keyup", (e) => {
  if(!/^(Arrow|Home|End|Page)/.test(e.key)) return;
  highlightActive();
});

/* focus into the nearest line when clicking the page margin */
editorEl.addEventListener("mousedown", (e) => {
  if(e.target !== editorEl) return;
  e.preventDefault();
  const lines = getLines();
  if(!lines.length){ ensureEditor(); }
  const all = getLines();
  const last = all[all.length-1];
  setCaret(last, (last.textContent||"").length);
  editorEl.focus();
  highlightActive();
});

/* drag-drop import */
["dragover","drop"].forEach(ev => document.addEventListener(ev, e => e.preventDefault()));
document.addEventListener("drop", (e) => {
  const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if(f) handleImportFile(f);
});

/* ================= importers ================= */

function handleImportFile(file){
  const name = file.name.toLowerCase();
  if(name.endsWith(".pdf")) return importPdf(file);
  if(name.endsWith(".fdx") || name.endsWith(".xml")) return importFdx(file);
  return importPlain(file);
}

function renderSceneNavigator(){
  const list = $("#sceneList");
  list.replaceChildren();
  getLines().forEach(line => {
    if(line.dataset.type !== "scene" || !line.textContent.trim()) return;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = line.textContent.trim();
    button.addEventListener("click", () => {
      line.scrollIntoView({block:"center"});
      setCaret(line, 0);
      editorEl.focus();
    });
    list.append(button);
  });
}

function findText(){ return $("#findText").value; }
function replaceSelection(replacement){
  const needle = findText();
  if(!needle) return false;
  const source = serialize();
  const index = source.indexOf(needle);
  if(index < 0) return false;
  const next = source.slice(0, index) + replacement + source.slice(index + needle.length);
  loadIntoEditor(next);
  onEdit();
  return true;
}

function replaceAll(){
  const needle = findText();
  if(!needle) return;
  const source = serialize();
  const next = source.split(needle).join($("#replaceText").value);
  if(next === source){ setStatus("Text not found"); return; }
  loadIntoEditor(next);
  onEdit();
  setStatus("Replaced all");
}

function importPlain(file){
  const reader = new FileReader();
  reader.onload = () => loadPlainContent(String(reader.result || ""), file.name);
  reader.readAsText(file);
}

function loadPlainContent(content, filename){
    flush();
    const base = String(filename).split(/[\\/]/).pop().replace(/\.[^.]+$/, "");
    const d = makeDoc(base || "Imported");
    d.text = content;
    store.docs.push(d);
    store.active = d.id;
    titleInput.value = d.title;
    loadIntoEditor(d.text);
    persist(); refreshDocList(); render();
    setStatus("Imported " + (base || "file"));
}

/* ---- Final Draft .fdx ---- */
function importFdx(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const xml = new DOMParser().parseFromString(String(reader.result||""), "text/xml");
      const paras = Array.from(xml.getElementsByTagName("Paragraph"));
      const out = [];
      const typeMap = {
        "Scene Heading": "scene", "Action": "action", "Character": "character",
        "Dialogue": "dialog", "Parenthetical": "paren", "Transition": "transition",
        "Shot": "scene", "General": "action", "Cast List": "action",
        "New Act": "section", "Sequence": "section"
      };
      let title = null, author = null;
      const tp = xml.getElementsByTagName("TitlePage")[0];
      if(tp){
        const content = tp.getElementsByTagName("Content")[0];
        if(content){
          const txt = content.textContent.trim();
          const m = txt.match(/^(.+?)(?:\n|$)/);
          if(m) title = m[1].trim();
        }
      }
      for(const p of paras){
        const type = typeMap[p.getAttribute("Type")] || "action";
        const texts = Array.from(p.getElementsByTagName("Text")).map(t => t.textContent).join("");
        const line = (texts || "").replace(/\s+/g, " ").trim();
        if(type === "scene"){ if(out.length && out[out.length-1] !== "") out.push(""); out.push(line.toUpperCase()); out.push(""); }
        else if(type === "action"){ if(out.length && out[out.length-1] !== "") out.push(""); out.push(line); out.push(""); }
        else if(type === "character"){ if(out.length && out[out.length-1] !== "") out.push(""); out.push(line.toUpperCase()); }
        else if(type === "paren"){ out.push("(" + line.replace(/^\(|\)$/g,"") + ")"); }
        else if(type === "dialog"){ out.push(line); }
        else if(type === "transition"){ if(out.length && out[out.length-1] !== "") out.push(""); out.push("> " + line.toUpperCase()); out.push(""); }
        else if(type === "section"){ if(out.length && out[out.length-1] !== "") out.push(""); out.push("# " + line); }
      }
      let body = out.join("\n").replace(/\n{3,}/g,"\n\n");
      if(title) body = "Title: " + title + "\nAuthor: " + (author||"") + "\n\n" + body;
      const d = makeDoc(file.name.replace(/\.[^.]+$/,"") || "Imported");
      d.text = body;
      store.docs.push(d); store.active = d.id;
      titleInput.value = d.title;
      loadIntoEditor(d.text);
      persist(); refreshDocList(); render();
      setStatus("Imported .fdx");
    }catch(err){
      console.error(err);
      setStatus("⚠ could not read .fdx");
    }
  };
  reader.readAsText(file);
}

/* ---- PDF ---- */
let pdfJsPromise = null;
function loadPdfJs(){
  if(window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if(pdfJsPromise) return pdfJsPromise;
  pdfJsPromise = new Promise((resolve, reject) => {
    const urls = ["vendor/pdf.min.js"];
    let idx = 0;
    (function tryNext(){
      if(idx >= urls.length){ reject(new Error("pdf.js unavailable")); return; }
      const url = urls[idx++];
      const s = document.createElement("script");
      s.src = url;
      s.onload = () => {
        if(window.pdfjsLib){
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js";
          resolve(window.pdfjsLib);
        } else tryNext();
      };
      s.onerror = tryNext;
      document.head.appendChild(s);
    })();
  });
  return pdfJsPromise;
}

function groupTextLines(items){
  const lines = [];
  for(const it of items){
    if(!it.str) continue;
    const x = it.transform[4], y = it.transform[5];
    let found = null;
    for(const l of lines){
      if(Math.abs(l.y - y) < 3.5){ found = l; break; }
    }
    if(!found){ found = { y, items: [] }; lines.push(found); }
    found.items.push({ x, str: it.str, w: it.width || 0 });
  }
  lines.sort((a,b) => b.y - a.y);
  for(const l of lines){
    l.items.sort((a,b) => a.x - b.x);
    let text = "";
    let prevEnd = null;
    for(const it of l.items){
      if(prevEnd !== null && it.x - prevEnd > 6 && !/\s$/.test(text) && !/^\s/.test(it.str)){
        text += " ";
      }
      text += it.str;
      prevEnd = it.x + it.w;
    }
    l.text = text.replace(/\s+/g," ").trim();
    l.x = l.items[0].x;
    l.y = l.y;
  }
  return lines;
}

async function importPdf(file){
  setStatus("Reading PDF…");
  try{
    const pdfjs = await loadPdfJs();
    const buf = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buf }).promise;
    const pages = [];
    for(let p = 1; p <= pdf.numPages; p++){
      const page = await pdf.getPage(p);
      const vp = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const lines = groupTextLines(content.items).filter(l => l.text);
      if(lines.length) pages.push({ lines, width: vp.width });
    }
    const fountain = pdfPagesToFountain(pages);
    flush();
    const d = makeDoc(file.name.replace(/\.[^.]+$/,"") || "Imported PDF");
    d.text = fountain;
    store.docs.push(d); store.active = d.id;
    titleInput.value = d.title;
    loadIntoEditor(d.text);
    persist(); refreshDocList(); render();
    setStatus("Imported PDF ✓");
  }catch(err){
    console.error(err);
    setStatus("⚠ Could not read PDF offline");
    alert("PDF import could not read this file. Try exporting the PDF again or use Fountain/text import.");
  }
}

function pdfPagesToFountain(pages){
  /* left margin = minimum x across all pages */
  let leftMargin = Infinity;
  for(const pg of pages){
    for(const l of pg.lines){
      if(l.x < leftMargin) leftMargin = l.x;
    }
  }
  if(!isFinite(leftMargin)) leftMargin = 0;

  const out = [];
  let prevType = null;
  let actionBuf = [];
  let prevY = null;
  let medianGap = 0;
  const gaps = [];

  /* estimate median line gap */
  for(const pg of pages){
    let last = null;
    for(const l of pg.lines){
      if(last !== null){
        const g = last.y - l.y;
        if(g > 1 && g < 60) gaps.push(g);
      }
      last = l;
    }
  }
  gaps.sort((a,b)=>a-b);
  medianGap = gaps.length ? gaps[Math.floor(gaps.length/2)] : 14;
  const paraGap = medianGap * 1.55;

  function flushAction(){
    if(!actionBuf.length) return;
    if(out.length && out[out.length-1] !== "") out.push("");
    out.push(actionBuf.join(" "));
    out.push("");
    actionBuf = [];
  }

  function push(line){
    const t = line.text.trim();
    if(!t) return;

    const d = line.x - leftMargin;
    let type;

    /* transitions by keyword regardless of position */
    if(/^(FADE\s*(IN|OUT|TO)?|CUT\s+TO|SMASH\s+CUT|MATCH\s+CUT|JUMP\s+CUT|DISSOLVE\s+TO|WIPE\s+TO|IRIS\s+(IN|OUT)|INTERCUT|BACK\s+TO|TIME\s+CUT|HARD\s+CUT)/i.test(t) && t.length < 45){
      type = "transition";
    } else if(d > 300){
      type = "transition";
    } else if(d > 130){
      type = "character";
    } else if(d > 85){
      type = "paren";
    } else if(d > 40){
      type = "dialog";
    } else {
      type = SCENE_RE.test(t) ? "scene" : "action";
    }

    /* paragraph break inside action? */
    if(type === "action" && prevY !== null && (prevY - line.y) > paraGap){
      flushAction();
    }

    if(type === "scene"){
      flushAction();
      if(out.length && out[out.length-1] !== "") out.push("");
      out.push(t.toUpperCase());
      out.push("");
    } else if(type === "action"){
      actionBuf.push(t);
    } else if(type === "character"){
      flushAction();
      if(out.length && out[out.length-1] !== "") out.push("");
      out.push(t.toUpperCase());
    } else if(type === "paren"){
      flushAction();
      out.push("(" + t.replace(/^\(|\)$/g,"") + ")");
    } else if(type === "dialog"){
      flushAction();
      out.push(t);
    } else if(type === "transition"){
      flushAction();
      if(out.length && out[out.length-1] !== "") out.push("");
      out.push("> " + t.toUpperCase());
      out.push("");
    }
    prevType = type;
    prevY = line.y;
  }

  for(const pg of pages){
    for(const l of pg.lines) push(l);
  }
  flushAction();

  return out.join("\n").replace(/\n{3,}/g,"\n\n").trim() + "\n";
}

/* ================= launchers ================= */

function downloadLaunchers(){
  const bat =
`@echo off
rem Hiiscript launcher (Windows)
rem Place this file next to Hiiscript.html and double-click it.
set "HTML=%~dp0Hiiscript.html"
if not exist "%HTML%" (
  echo.
  echo   Could not find Hiiscript.html next to this file.
  echo   Save the page as Hiiscript.html in the same folder.
  echo.
  pause
  exit /b 1
)
start "" "%HTML%"
`;
  const sh =
`#!/bin/sh
# Hiiscript launcher (Linux / macOS)
# Place this next to Hiiscript.html, then: chmod +x hiiscript.sh
DIR="$(cd "$(dirname "$0")" && pwd)"
HTML="$DIR/Hiiscript.html"
if [ ! -f "$HTML" ]; then
  echo "Could not find Hiiscript.html next to this script."
  exit 1
fi
URL="file://$HTML"
if command -v xdg-open >/dev/null 2>&1; then exec xdg-open "$URL"; fi
if command -v sensible-browser >/dev/null 2>&1; then exec sensible-browser "$URL"; fi
if command -v gio >/dev/null 2>&1; then exec gio open "$URL"; fi
if command -v firefox >/dev/null 2>&1; then exec firefox "$URL"; fi
if command -v google-chrome >/dev/null 2>&1; then exec google-chrome "$URL"; fi
if command -v chromium >/dev/null 2>&1; then exec chromium "$URL"; fi
echo "Open this in your browser: $URL"
`;
  download("Hiiscript.bat", bat, "application/bat");
  setTimeout(() => download("hiiscript.sh", sh, "text/x-shellscript"), 350);
  setStatus("Launchers downloaded — put them beside the .html");
}

/* ================= UI wiring ================= */



function updateTemplateNotice(){
  templateNotice.classList.toggle("visible", store.firstRun === true);
}

$("#dismissTemplate").addEventListener("click", () => {
  store.firstRun = false;
  persist();
  updateTemplateNotice();
});

function libraryItems(kind){
  if(!Array.isArray(store[kind])) store[kind] = [];
  return store[kind];
}

function renderLibrary(){
  for(const [kind, id] of [["characters", "characterLibrary"], ["scenes", "sceneLibrary"]]){
    const list = $("#" + id);
    list.replaceChildren();
    libraryItems(kind).forEach((value, index) => {
      const row = document.createElement("div");
      row.className = "library-entry";
      const input = document.createElement("input");
      input.value = value;
      input.setAttribute("aria-label", `${kind.slice(0,-1)} ${index + 1}`);
      input.addEventListener("change", () => {
        const next = input.value.trim();
        if(!next) return renderLibrary();
        store[kind][index] = kind === "characters" ? next.toUpperCase() : next.toUpperCase();
        store[kind] = Array.from(new Set(store[kind])).sort((a,b) => a.localeCompare(b));
        persist(); renderLibrary();
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Delete";
      remove.addEventListener("click", () => {
        store[kind].splice(index, 1);
        persist(); renderLibrary();
      });
      row.append(input, remove);
      list.append(row);
    });
  }
}

function addLibraryItem(kind, inputId){
  const input = $(inputId);
  const value = input.value.trim();
  if(!value) return;
  if(!Array.isArray(store[kind])) store[kind] = [];
  store[kind].push(kind === "characters" ? value.toUpperCase() : value.toUpperCase());
  store[kind] = Array.from(new Set(store[kind])).sort((a,b) => a.localeCompare(b));
  input.value = "";
  persist(); renderLibrary();
}

function openLibrary(){
  renderLibrary();
  $("#libraryModal").classList.add("open");
}

$("#btnLibrary").addEventListener("click", openLibrary);
$("#closeLibrary").addEventListener("click", () => $("#libraryModal").classList.remove("open"));
$("#libraryModal").addEventListener("click", e => {
  if(e.target.id === "libraryModal") e.currentTarget.classList.remove("open");
});
$("#addCharacter").addEventListener("click", () => addLibraryItem("characters", "#newCharacter"));
$("#addScene").addEventListener("click", () => addLibraryItem("scenes", "#newScene"));
$("#exportLibrary").addEventListener("click", () => {
  download("kabrownie-library.json", JSON.stringify({version:1, characters:libraryItems("characters"), scenes:libraryItems("scenes")}, null, 2), "application/json;charset=utf-8");
});
$("#importLibrary").addEventListener("click", () => $("#libraryFile").click());
$("#libraryFile").addEventListener("change", e => {
  const file = e.target.files && e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const imported = JSON.parse(String(reader.result || ""));
      for(const kind of ["characters", "scenes"]){
        const values = Array.isArray(imported[kind]) ? imported[kind] : [];
        store[kind] = Array.from(new Set([...libraryItems(kind), ...values]
          .filter(value => typeof value === "string" && value.trim())
          .map(value => value.trim().toUpperCase()))).sort((a,b) => a.localeCompare(b));
      }
      persist(); renderLibrary(); setStatus("Library imported");
    }catch(err){ setStatus("Invalid library file"); }
  };
  reader.readAsText(file);
  e.target.value = "";
});

titleInput.addEventListener("input", () => {
  const d = activeDoc();
  if(d){ d.title = titleInput.value.trim() || "Untitled"; }
  captureHistory();
  scheduleSave();
});

docSelect.addEventListener("change", () => {
  flush();
  store.active = docSelect.value;
  const d = activeDoc();
  titleInput.value = d.title;
  loadIntoEditor(d.text);
  persist();
  render();
  highlightActive();
  editorEl.focus();
});

$("#btnNew").addEventListener("click", () => {
  flush();
  store.firstRun = false;
  updateTemplateNotice();
  const d = makeDoc("Untitled");
  store.docs.push(d);
  store.active = d.id;
  titleInput.value = d.title;
  loadIntoEditor("");
  persist(); refreshDocList(); render();
  titleInput.focus(); titleInput.select();
});

$("#btnNewTemplate").addEventListener("click", () => {
  flush();
  store.firstRun = false;
  updateTemplateNotice();
  const d = makeDoc("The Last Signal — Template", STARTER_TEMPLATE);
  store.docs.push(d);
  store.active = d.id;
  store.characters = Array.from(new Set([...(store.characters || []), "NOVA", "VEX", "RADIO VOICE"])).sort((a,b) => a.localeCompare(b));
  store.scenes = Array.from(new Set([...(store.scenes || []), "INT. CITY ROOFTOP - NIGHT"])).sort((a,b) => a.localeCompare(b));
  titleInput.value = d.title;
  loadIntoEditor(d.text);
  persist(); refreshDocList(); render(); highlightActive();
  setStatus("New script created from template");
  editorEl.focus();
});

$("#btnFrontPage").addEventListener("click", () => {
  const src = serialize();
  if(parseFountain(src).titlePage){
    setStatus("Front page already exists");
    return;
  }
  const title = titleInput.value.trim() || "Untitled";
  loadIntoEditor(`Title: ${title}\nCredit: \nAuthor: \n\n${src}`);
  flush(); render(); highlightActive();
  setStatus("Front page added");
});

$("#btnPageBreak").addEventListener("click", () => {
  const line = getCurrentLine();
  const breakLine = newLine("===", "pagebreak");
  if(line) line.parentNode.insertBefore(breakLine, line.nextSibling);
  else { ensureEditor(); editorEl.appendChild(breakLine); }
  setCaret(breakLine, breakLine.textContent.length);
  onEdit();
  setStatus("Page break inserted");
});

function applyLayout(name){
  const valid = ["editor", "split", "preview"];
  const layout = valid.includes(name) ? name : "editor";
  mainEl.dataset.layout = layout;
  document.querySelectorAll("[data-layout]").forEach(b => {
    b.classList.toggle("active", b.dataset.layout === layout);
  });
}

document.querySelectorAll("[data-layout]").forEach(btn => {
  btn.addEventListener("click", () => {
    const layout = btn.dataset.layout;
    store.layout = layout;
    persist();
    applyLayout(layout);
    render();
  });
});

function exportCurrent(format){
  flush();
  const d = activeDoc();
  const safe = (d.title || "screenplay").replace(/[^\w\-. ]+/g, "").trim() || "screenplay";
  if(format === "pdf"){
    const previous = mainEl.dataset.layout;
    mainEl.dataset.layout = "preview";
    render();
    setTimeout(() => { window.print(); mainEl.dataset.layout = previous; }, 80);
    return;
  }
  if(format === "markdown") download(safe + ".md", ScreenplayCore.fountainToMarkdown(d.text), "text/markdown;charset=utf-8");
  else download(safe + ".fountain", d.text, "text/plain;charset=utf-8");
  setStatus("Exported " + (format === "markdown" ? ".md" : ".fountain"));
}

$("#btnExport").addEventListener("click", () => exportCurrent($("#menuExportFormat").value));

$("#btnUndo").addEventListener("click", undo);
$("#btnRedo").addEventListener("click", redo);
$("#quickUndo").addEventListener("click", undo);
$("#quickRedo").addEventListener("click", redo);
$("#quickSave").addEventListener("click", () => saveDraftFile().catch(() => setStatus("Could not save file")));
$("#quickExport").addEventListener("click", () => exportCurrent($("#exportFormat").value));
$("#btnScenes").addEventListener("click", () => {
  renderSceneNavigator();
  $("#sceneNav").classList.toggle("open");
});
function setFocusMode(enabled){
  document.body.classList.toggle("focus-mode", enabled);
  if(!enabled) editorEl.focus();
}
$("#btnFocus").addEventListener("click", () => setFocusMode(!document.body.classList.contains("focus-mode")));
$("#focusExit").addEventListener("click", () => setFocusMode(false));
$("#btnFind").addEventListener("click", () => { $("#findModal").classList.add("open"); ScreenplayAccessibility.openModal($("#findModal"), $("#btnFind")); });
$("#closeFind").addEventListener("click", () => ScreenplayAccessibility.closeModal($("#findModal")));
$("#findModal").addEventListener("click", e => { if(e.target.id === "findModal") ScreenplayAccessibility.closeModal($("#findModal")); });
$("#findNext").addEventListener("click", () => setStatus(replaceSelection(findText()) ? "Found" : "Text not found"));
$("#replaceOne").addEventListener("click", () => setStatus(replaceSelection($("#replaceText").value) ? "Replaced" : "Text not found"));
$("#replaceAll").addEventListener("click", replaceAll);

$("#btnSave").addEventListener("click", () => saveDraftFile().catch(() => setStatus("Could not save file")));
$("#btnOpen").addEventListener("click", () => openDraftFile().catch(() => setStatus("Could not open draft")));
$("#draftInput").addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{ loadDraftContent(String(reader.result || "")); }
    catch(err){ setStatus("Invalid draft file"); }
  };
  reader.readAsText(file);
  e.target.value = "";
});

const importAccept = {any:".pdf,.fountain,.txt,.spmd,.md,.fdx,.xml,.json", fountain:".fountain,.txt,.spmd,.md", fdx:".fdx,.xml", pdf:".pdf", json:".json"};
$("#importFormat").addEventListener("change", e => $("#fileInput").accept = importAccept[e.target.value] || importAccept.any);
$("#btnImport").addEventListener("click", () => $("#fileInput").click());
$("#fileInput").addEventListener("change", (e) => {
  const f = e.target.files && e.target.files[0];
  if(f){
    if(f.name.toLowerCase().endsWith(".json")){
      const reader = new FileReader();
      reader.onload = () => { try{ loadDraftContent(String(reader.result || "")); } catch(err){ setStatus("Invalid project backup"); } };
      reader.readAsText(f);
    } else handleImportFile(f);
  }
  e.target.value = "";
});

$("#exportFormat").addEventListener("change", e => { $("#menuExportFormat").value = e.target.value; });
$("#menuExportFormat").addEventListener("change", e => { $("#exportFormat").value = e.target.value; });

$("#btnPrint").addEventListener("click", () => exportCurrent("pdf"));

$("#menuToggle").addEventListener("click", () => {
  const open = !headerEl.classList.contains("menu-open");
  headerEl.classList.toggle("menu-open", open);
  $("#menuToggle").setAttribute("aria-expanded", String(open));
});

$("#btnLaunchers").addEventListener("click", downloadLaunchers);
$("#btnHelp").addEventListener("click", () => { $("#modal").classList.add("open"); ScreenplayAccessibility.openModal($("#modal"), $("#btnHelp")); });
$("#btnCloseModal").addEventListener("click", () => ScreenplayAccessibility.closeModal($("#modal")));
$("#modal").addEventListener("click", (e) => { if(e.target.id === "modal") ScreenplayAccessibility.closeModal($("#modal")); });
$("#btnAbout").addEventListener("click", () => { $("#aboutModal").classList.add("open"); ScreenplayAccessibility.openModal($("#aboutModal"), $("#btnAbout")); });
$("#closeAbout").addEventListener("click", () => ScreenplayAccessibility.closeModal($("#aboutModal")));
$("#aboutModal").addEventListener("click", (e) => { if(e.target.id === "aboutModal") ScreenplayAccessibility.closeModal($("#aboutModal")); });
$("#aboutVersion").textContent = APP_VERSION;
$("#btnReportBug").addEventListener("click", () => {
  window.open(
    "https://github.com/kabrownie/HiiScript/issues/new/choose",
    "_blank",
    "noopener,noreferrer"
  );
});
const updateToggle = $("#updateChecksToggle");
updateToggle.checked = !!store.updateChecks;
updateToggle.addEventListener("change", () => {
  store.updateChecks = updateToggle.checked;
  persist();
  if(store.updateChecks) checkForUpdates();
});

document.querySelectorAll(".toolbar-menu").forEach(menu => {
  menu.addEventListener("mouseleave", () => menu.removeAttribute("open"));
});
document.addEventListener("click", (e) => {
  if(!e.target.closest(".toolbar-menu") && !e.target.closest("summary")) {
    document.querySelectorAll(".toolbar-menu").forEach(menu => menu.removeAttribute("open"));
  }
});
document.addEventListener("keydown", (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if(mod && e.key.toLowerCase() === "z"){
    e.preventDefault();
    if(e.shiftKey) redo(); else undo();
    return;
  }
  if(e.key === "Escape"){
    if(document.body.classList.contains("focus-mode")){ setFocusMode(false); return; }
    ScreenplayAccessibility.closeModal($("#modal"));
    ScreenplayAccessibility.closeModal($("#aboutModal"));
    ScreenplayAccessibility.closeModal($("#findModal"));
    $("#sceneNav").classList.remove("open");
    hideAuto();
    document.querySelectorAll(".toolbar-menu").forEach(menu => menu.removeAttribute("open"));
  }
});

async function checkForUpdates(){
  if(!store.updateChecks) return;

  const key = "kabrownie.screen.update-check";
  const last = Number(localStorage.getItem(key) || 0);
  if(Date.now() - last < 6 * 60 * 60 * 1000) return;
  localStorage.setItem(key, String(Date.now()));

  try{
    const response = await fetch(
      "https://api.github.com/repos/kabrownie/HiiScript/releases/latest",
      { headers: { Accept: "application/vnd.github+json" } }
    );
    if(!response.ok) return;

    const release = await response.json();
    const latest = String(release.tag_name || "").replace(/^v/i, "");

    if(latest && ScreenplayCore.compareVersions(latest, APP_VERSION) > 0){
      updateNotice.innerHTML =
        `Update ${esc(latest)} available ` +
        `<a href="${esc(release.html_url || "https://github.com/kabrownie/HiiScript/releases/latest")}" ` +
        `target="_blank" rel="noopener">View</a>`;
      updateNotice.classList.add("visible");
    }
  }catch(err){
    /* offline is fine — updates are optional and must never interrupt writing */
  }
}

window.addEventListener("resize", () => { if(autoBox.classList.contains("open")) positionAuto(); });
document.addEventListener("selectionchange", () => {
  if(!autoBox.classList.contains("open")) return;
  const line = getCurrentLine();
  if(!line) hideAuto();
});

window.addEventListener("beforeunload", () => { flush(); });

/* ================= boot ================= */

function applyRecovery(recovery){
  titleInput.value = recovery.title;
  loadIntoEditor(recovery.text);
  setStatus("Recovered unsaved work");
  dirty = true;
  setSaveState(false);
  writeRecoverySnapshot();
}

function finishInit(recovered){
  applyLayout(store.layout || "editor");

  refreshDocList();
  render();
  persist();
  updateTemplateNotice();
  highlightActive();
  editorEl.focus();
  const first = getLines()[0];
  if(first) setCaret(first, (first.textContent||"").length);
  history = [{text: serialize(), title: titleInput.value}];
  historyIndex = 0;
  updateHistoryButtons();
  if(!recovered){
    setSaveState(true);
  }
  checkForUpdates();
}

function promptRecovery(recovery){
  const modal = $("#recoveryModal");
  const info  = $("#recoveryInfo");
  const restoreBtn = $("#recoveryRestore");
  const discardBtn = $("#recoveryDiscard");

  info.textContent = `Snapshot taken ${new Date(recovery.updated).toLocaleString()}.`;

  const onRestore = () => close(true);
  const onDiscard = () => close(false);

  function close(restore){
    modal.classList.remove("open");
    restoreBtn.removeEventListener("click", onRestore);
    discardBtn.removeEventListener("click", onDiscard);
    if(restore){
      applyRecovery(recovery);
      finishInit(true);
    } else {
      clearRecoverySnapshot();
      finishInit(false);
    }
  }

  restoreBtn.addEventListener("click", onRestore);
  discardBtn.addEventListener("click", onDiscard);
  modal.classList.add("open");
  ScreenplayAccessibility.openModal(modal, restoreBtn);
}

(async function init(){
  await loadStore();

  const d = activeDoc();
  titleInput.value = d.title;
  loadIntoEditor(d.text);

  const recovery = await recoverySnapshot();
  if(!recovery || recovery.text === d.text){
    await clearRecoverySnapshot();
    finishInit(false);
    return;
  }
  promptRecovery(recovery);
})();