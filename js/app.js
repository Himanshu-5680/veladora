import { KINDS, RULES, analyze, languageOf } from "./analyzer.js";
import { archivistDraft, epitaphFallback, epitaphMessages, languageMessages, seanceMessages } from "./draft.js";
import { issueBody, toCsv, toJson, toMarkdown } from "./export.js";
import { isGarbage } from "./garbage.js";
import { LANGUAGES } from "./languages.js";
import { sampleFiles } from "./samples.js";
import { parseGitLog } from "./timeline.js";

const STARTERS = {
  cobol: "       IDENTIFICATION DIVISION.\n       PROGRAM-ID. HELLO.\n       PROCEDURE DIVISION.\n           DISPLAY \"HELLO\".\n           STOP RUN.\n",
  fortran: "      PROGRAM HELLO\n      PRINT *, 'HELLO'\n      END\n",
  pascal: "program Hello;\nbegin\n  writeln('hello')\nend.\n",
  basic: "10 PRINT \"HELLO\"\n20 END\n",
  prolog: "parent(ada, countess).\nancestor(X, Y) :- parent(X, Y).\n",
  forth: ": SQUARE ( n -- n2 ) DUP * ;\n",
  ada: "with Ada.Text_IO;\nprocedure Hello is\nbegin\n   Ada.Text_IO.Put_Line (\"hello\");\nend Hello;\n",
};

const SAMPLE_LOG = [
  "c0ffee1\tMina Calder\t2014-03-18\tpayroll compiles on the night box",
  "a11ce00\tJonah Abebe\t2017-08-02\tcopied formatMoney during the rush",
  "b0a7d09\tMina Calder\t2019-12-14\tholiday rates still wrong, left a FIXME",
  "deadd00\tR. Okonkwo\t2022-01-09\tmigration script unpickles the old shifts",
].join("\n");

const state = {
  files: [],
  source: "sample",
  report: null,
  filter: "all",
  reveal: false,
  worker: null,
  model: "off",
  modelLabel: "",
  streaming: false,
  request: 0,
  target: null,
  language: LANGUAGES[0],
};

const $ = (id) => document.getElementById(id);

const FILTERS = [
  ["all", "All"],
  ["high", "High"],
  ["secret", "Secrets"],
  ["danger", "Risks"],
  ["todo", "Notes"],
  ["empty", "Empty"],
  ["duplicate", "Copies"],
];

function boot() {
  $("theme").addEventListener("click", toggleTheme);
  syncTheme();
  $("dir-input").addEventListener("change", (event) => ingest(event.target.files, "your folder"));
  $("file-input").addEventListener("change", (event) => ingest(event.target.files, "your files"));
  $("use-sample").addEventListener("click", () => load(sampleFiles(), "sample"));
  $("clear").addEventListener("click", () => load([], "empty"));
  $("add-paste").addEventListener("click", addPaste);
  $("reveal").addEventListener("click", () => {
    state.reveal = !state.reveal;
    $("reveal").setAttribute("aria-pressed", String(state.reveal));
    $("reveal-note").hidden = !state.reveal;
    renderFindings();
  });
  $("download-md").addEventListener("click", () => save(toMarkdown(state.report)));
  $("download-json").addEventListener("click", () => save(toJson(state.report), "application/json"));
  $("download-csv").addEventListener("click", () => save(toCsv(state.report), "text/csv"));
  $("copy-issue").addEventListener("click", copyIssue);
  $("light-gemma").addEventListener("click", () => light("gemma"));
  $("light-small").addEventListener("click", () => light("understudy"));
  $("extinguish").addEventListener("click", extinguish);
  $("ask-seance").addEventListener("click", () => ask(seanceMessages(state.report), $("model-output")));
  $("paint-altar").addEventListener("click", paintAltar);
  $("from-loudest").addEventListener("click", fromLoudest);
  $("ask-epitaph").addEventListener("click", askEpitaph);
  $("print-card").addEventListener("click", () => { show("altar"); window.print(); });
  $("ask-lang").addEventListener("click", () => ask(languageMessages(state.language, $("lang-snippet").value), $("lang-output")));
  $("read-log").addEventListener("click", () => renderLog($("log-text").value));
  $("sample-log").addEventListener("click", () => { $("log-text").value = SAMPLE_LOG; renderLog(SAMPLE_LOG); });
  $("repo-input").value = localStorage.getItem("veladora-repo") || "";
  $("repo-input").addEventListener("change", () => localStorage.setItem("veladora-repo", $("repo-input").value.trim()));

  const drop = $("drop");
  ["dragenter", "dragover"].forEach((name) => drop.addEventListener(name, (event) => {
    event.preventDefault();
    drop.classList.add("over");
  }));
  ["dragleave", "drop"].forEach((name) => drop.addEventListener(name, (event) => {
    event.preventDefault();
    drop.classList.remove("over");
  }));
  drop.addEventListener("drop", onDrop);

  document.querySelectorAll("[role=tab]").forEach((tab) => {
    tab.addEventListener("click", () => show(tab.getAttribute("aria-controls")));
  });
  document.querySelectorAll(".top nav a").forEach((link) => {
    const id = (link.getAttribute("href") || "").slice(1);
    if ($(id)) link.addEventListener("click", () => show(id));
  });

  renderFilters();
  renderRules();
  renderLanguages();
  load(sampleFiles(), "sample");
  paintAltar();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register(new URL("../sw.js", import.meta.url)).catch(() => {});
  }
}

function show(id) {
  document.querySelectorAll("[role=tab]").forEach((tab) => {
    const on = tab.getAttribute("aria-controls") === id;
    tab.setAttribute("aria-selected", String(on));
  });
  document.querySelectorAll(".panel").forEach((panel) => {
    const on = panel.id === id;
    panel.hidden = !on;
    panel.classList.toggle("on", on);
  });
}

function toggleTheme() {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("veladora-theme", next);
  syncTheme();
}

const VIGIL_LABEL = {
  tended: "good",
  flickering: "needs a look",
  haunted: "needs work",
  possessed: "fix first",
};

function syncTheme() {
  const dark = document.documentElement.getAttribute("data-theme") !== "light";
  const button = $("theme");
  button.setAttribute("aria-pressed", String(dark));
  button.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
}

function load(files, source) {
  state.files = files;
  state.source = source;
  state.report = analyze(files);
  const label = {
    sample: "Sample project is loaded. It is made up. It uses the public AWS example keys so you can see a warning.",
    empty: "Nothing loaded. Drop a folder when you are ready.",
  }[source] || `${files.length} files from ${source}. Read in this tab only.`;
  $("source-label").textContent = label;
  renderReport();
  if (state.language && $("lang-snippet")) selectLanguage(state.language);
}

async function ingest(fileList, source) {
  const files = [];
  for (const file of fileList || []) {
    if (files.length >= 200) break;
    if (file.size > 350000) continue;
    const path = (file.webkitRelativePath || file.name).replace(/\\/g, "/");
    if (/(^|\/)(node_modules|vendor|\.git|dist|build)(\/|$)/i.test(path)) continue;
    const text = await file.text();
    if (text.includes("\0")) continue;
    files.push({ path, text });
  }
  load(files, source);
}

async function onDrop(event) {
  const items = [...(event.dataTransfer?.items || [])];
  const entries = items.map((item) => item.webkitGetAsEntry && item.webkitGetAsEntry()).filter(Boolean);
  if (!entries.length) {
    ingest(event.dataTransfer.files, "the drop");
    return;
  }
  const files = [];
  for (const entry of entries) files.push(...await walk(entry));
  load(files.slice(0, 200), "the drop");
}

function walk(entry, prefix = "") {
  return new Promise((resolve) => {
    if (entry.isFile) {
      entry.file(async (file) => {
        if (file.size > 350000) return resolve([]);
        const text = await file.text();
        if (text.includes("\0")) return resolve([]);
        resolve([{ path: `${prefix}${file.name}`, text }]);
      }, () => resolve([]));
      return;
    }
    if (!entry.isDirectory) return resolve([]);
    const reader = entry.createReader();
    const all = [];
    const read = () => reader.readEntries(async (batch) => {
      if (!batch.length) {
        const nested = [];
        for (const child of all) nested.push(...await walk(child, `${prefix}${entry.name}/`));
        resolve(nested);
        return;
      }
      all.push(...batch);
      read();
    }, () => resolve([]));
    read();
  });
}

function addPaste() {
  const path = ($("paste-name").value || "snippet.txt").trim();
  const text = $("paste-text").value;
  if (!text.trim()) return;
  const next = state.source === "empty" ? [] : state.files.slice();
  next.push({ path, text });
  load(next, "your scrap");
  $("paste-text").value = "";
}

function renderReport() {
  const report = state.report;
  $("stat-score").textContent = report.files.length ? String(report.score) : "–";
  $("stat-files").textContent = String(report.stats.fileCount);
  $("stat-high").textContent = String(report.stats.bySeverity.high);
  $("stat-low").textContent = String(report.stats.bySeverity.medium + report.stats.bySeverity.low);
  $("score-num").textContent = report.files.length ? String(report.score) : "–";
  const vigil = $("score-vigil");
  vigil.textContent = report.files.length ? (VIGIL_LABEL[report.vigil] || report.vigil) : "empty";
  vigil.className = `vigil ${report.vigil}`;
  $("score-line").textContent = report.files.length
    ? `${report.stats.findingCount} issues. ${report.stats.licenseSeen ? "A license file is here." : "No license file."}`
    : "Nothing loaded.";
  const bar = $("score-bar");
  if (bar) bar.style.width = report.files.length ? `${Math.max(0, Math.min(100, report.score))}%` : "0%";
  const chips = $("file-chips");
  chips.replaceChildren();
  for (const file of report.files.slice(0, 12)) {
    const chip = document.createElement("span");
    chip.textContent = file.path;
    chips.append(chip);
  }
  $("draft").textContent = archivistDraft(report);
  renderFindings();
  const notes = $("notes-list");
  notes.replaceChildren();
  for (const note of report.notes) {
    const p = document.createElement("p");
    p.className = "note";
    p.textContent = note;
    notes.append(p);
  }
}

function renderFilters() {
  const bar = $("filters");
  bar.replaceChildren();
  for (const [id, label] of FILTERS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn alt";
    button.textContent = label;
    button.setAttribute("aria-pressed", String(state.filter === id));
    button.addEventListener("click", () => {
      state.filter = id;
      renderFilters();
      renderFindings();
    });
    bar.append(button);
  }
}

function shownFindings() {
  return state.report.findings.filter((finding) => {
    if (state.filter === "all") return true;
    if (state.filter === "high") return finding.severity === "high";
    return finding.kind === state.filter;
  });
}

function renderFindings() {
  const root = $("findings");
  root.replaceChildren();
  const list = shownFindings();
  if (!list.length) {
    const p = document.createElement("p");
    p.className = "alert";
    p.textContent = state.report.files.length
      ? "Nothing in this filter."
      : "Drop a folder, or load the sample.";
    root.append(p);
    return;
  }
  for (const finding of list) {
    const card = document.createElement("article");
    card.className = "card finding";
    const header = document.createElement("header");
    const tag = document.createElement("span");
    tag.className = `tag ${finding.severity}`;
    tag.textContent = `${finding.severity} · ${KINDS[finding.kind] || finding.kind}`;
    const where = document.createElement("span");
    where.className = "where";
    where.textContent = `${finding.file}:${finding.line}`;
    header.append(tag, where);
    const title = document.createElement("h3");
    title.textContent = finding.title;
    const evidence = document.createElement("p");
    evidence.className = "evidence";
    evidence.textContent = state.reveal && finding.localValue ? finding.localValue : finding.evidence;
    const action = document.createElement("p");
    action.className = "do";
    action.textContent = finding.action;
    card.append(header, title, evidence, action);
    root.append(card);
  }
}

function renderRules() {
  const root = $("rules");
  root.replaceChildren();
  for (const rule of RULES) {
    const row = document.createElement("tr");
    for (const value of [rule.severity, KINDS[rule.kind] || rule.kind, rule.looksFor]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    root.append(row);
  }
}

function renderLanguages() {
  const root = $("lang-list");
  root.replaceChildren();
  for (const language of LANGUAGES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn alt";
    button.innerHTML = "";
    const name = document.createElement("b");
    name.textContent = language.name;
    const small = document.createElement("small");
    small.textContent = `${language.born} · ${language.status}`;
    button.append(name, small);
    button.addEventListener("click", () => selectLanguage(language));
    root.append(button);
  }
  selectLanguage(LANGUAGES[0]);
}

function selectLanguage(language) {
  state.language = language;
  $("lang-status").textContent = `${language.name} · ${language.epithet}`;
  $("lang-fact").textContent = language.fact;
  const owned = state.files.find((file) => languageOf(file.path).toLowerCase() === language.name.toLowerCase());
  $("lang-snippet").value = owned ? owned.text : (STARTERS[language.id] || "");
  document.querySelectorAll("#lang-list button").forEach((button) => {
    button.classList.toggle("on", button.querySelector("b")?.textContent === language.name);
    button.setAttribute("aria-pressed", String(button.classList.contains("on")));
  });
}

function paintAltar() {
  const facts = altarFacts();
  $("altar-title").textContent = facts.name || "Untitled";
  $("altar-meta").textContent = facts.years || "";
  $("altar-body").textContent = epitaphFallback(facts);
}

function altarFacts() {
  return {
    name: $("altar-name").value.trim(),
    years: $("altar-years").value.trim(),
    loved: $("altar-loved").value.trim(),
    story: $("altar-story").value.trim(),
  };
}

function fromLoudest() {
  const finding = state.report.findings[0];
  if (!finding) return;
  $("altar-name").value = finding.title;
  $("altar-years").value = `${finding.file}:${finding.line}`;
  $("altar-loved").value = KINDS[finding.kind] || finding.kind;
  $("altar-story").value = finding.action;
  paintAltar();
}

function askEpitaph() {
  const facts = altarFacts();
  paintAltar();
  const text = `Name: ${facts.name}\nWhen or where: ${facts.years}\nWhat they kept: ${facts.loved}\nDetail: ${facts.story}`;
  ask(epitaphMessages(text), $("altar-body"));
}

function renderLog(text) {
  const parsed = parseGitLog(text);
  const root = $("timeline-out");
  root.replaceChildren();
  const summary = document.createElement("p");
  summary.textContent = `${parsed.commits.length} commits, ${parsed.authors.length} people. ${parsed.skipped} lines were not the tab-separated log.`;
  root.append(summary);
  for (const author of parsed.authors) {
    const block = document.createElement("article");
    block.className = "person";
    const avatar = document.createElement("span");
    avatar.className = "avatar";
    avatar.textContent = (author.name || "?").trim().slice(0, 1).toUpperCase();
    avatar.setAttribute("aria-hidden", "true");
    const title = document.createElement("strong");
    title.textContent = author.name;
    const meta = document.createElement("p");
    meta.className = "note";
    meta.textContent = `${author.commits} commits · ${author.first} → ${author.last}`;
    block.append(avatar, title, meta);
    for (const subject of author.subjects) {
      const line = document.createElement("p");
      line.textContent = subject;
      block.append(line);
    }
    root.append(block);
  }
}

function ensureWorker() {
  if (state.worker) return state.worker;
  const worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
  worker.onmessage = onWorker;
  worker.onerror = () => setStatus("The model failed to start. The written summary is still here.");
  state.worker = worker;
  return worker;
}

function light(which) {
  state.model = "loading";
  state.modelLabel = which === "gemma" ? "Gemma 3 270M" : "SmolLM2 135M";
  setStatus(`Starting ${state.modelLabel}. The first visit downloads the model into this browser.`);
  ensureWorker().postMessage({ type: "load", which });
}

function extinguish() {
  if (state.worker) state.worker.terminate();
  state.worker = null;
  state.model = "off";
  state.streaming = false;
  setStatus("Model stopped. Files already downloaded stay in this browser.");
}

function ask(messages, box) {
  if (state.model !== "ready") {
    box.textContent = "Start a model first. The written summary does not need one, and it is already on the page.";
    return;
  }
  if (state.streaming) return;
  state.request += 1;
  state.target = box;
  state.streaming = true;
  box.textContent = "";
  ensureWorker().postMessage({ type: "generate", id: state.request, messages, maxNewTokens: 170 });
}

function onWorker(event) {
  const msg = event.data || {};
  if (msg.type === "progress") {
    const pct = typeof msg.progress === "number" ? ` ${Math.round(msg.progress)}%` : "";
    const file = msg.file ? msg.file.split("/").pop() : "weights";
    setStatus(`${state.modelLabel}: ${file}${pct}`);
    return;
  }
  if (msg.type === "status") {
    setStatus(`Loading ${msg.label} on ${msg.device} (${msg.dtype}).`);
    return;
  }
  if (msg.type === "ready") {
    state.model = "ready";
    state.modelLabel = msg.label;
    setStatus(`${msg.label} is ready on this computer. Ask it to read the list.`);
    return;
  }
  if (msg.type === "token" && msg.id === state.request && state.target) {
    state.target.textContent += msg.text;
    const rate = msg.seconds > 0 ? Math.round(msg.steps / msg.seconds) : 0;
    $("model-rate").textContent = rate ? `About ${rate} steps a second.` : "";
    return;
  }
  if (msg.type === "done" && msg.id === state.request) {
    state.streaming = false;
    const text = (msg.text || (state.target && state.target.textContent) || "").trim();
    if (state.target && isGarbage(text)) {
      state.target.textContent = "The model repeated itself. Showing the written summary instead.\n\n" + archivistDraft(state.report);
    } else if (state.target && text) {
      state.target.textContent = text;
    }
    const rate = msg.seconds > 0 ? Math.round((msg.steps || 0) / msg.seconds) : 0;
    $("model-rate").textContent = rate ? `Finished. About ${rate} steps a second.` : "Finished.";
    return;
  }
  if (msg.type === "error") {
    state.model = state.model === "ready" ? "ready" : "error";
    state.streaming = false;
    setStatus(msg.message || "The model stopped.");
  }
}

function setStatus(text) {
  $("model-status").textContent = text;
}

function save(file, type = "text/markdown") {
  const blob = new Blob([file.text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function copyIssue() {
  const issue = issueBody(state.report);
  const repo = $("repo-input").value.trim();
  try {
    await navigator.clipboard.writeText(`${issue.title}\n\n${issue.body}`);
  } catch {
    $("paste-text").value = issue.body;
  }
  if (/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    const url = new URL(`https://github.com/${repo}/issues/new`);
    url.searchParams.set("title", issue.title);
    url.searchParams.set("body", issue.body.slice(0, 1500));
    window.open(url, "_blank", "noopener");
  }
}

boot();
