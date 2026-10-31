/**
 * Local rule engine. No network. Findings keep secret text out of
 * evidence; the raw match stays in localValue for an on-screen reveal.
 */

export const LIMITS = {
  maxFiles: 200,
  maxBytes: 350_000,
};

const SKIP = /(^|\/)(node_modules|vendor|\.git|dist|build|coverage|__pycache__|\.next|out)(\/|$)/i;

const EXT_LANG = {
  js: "JavaScript", jsx: "JavaScript", mjs: "JavaScript", cjs: "JavaScript",
  ts: "TypeScript", tsx: "TypeScript", py: "Python", rb: "Ruby", go: "Go",
  rs: "Rust", java: "Java", c: "C", h: "C", cpp: "C++", cc: "C++", hpp: "C++",
  cs: "C#", php: "PHP", cob: "COBOL", cbl: "COBOL", cpy: "COBOL",
  f: "Fortran", for: "Fortran", f90: "Fortran", f95: "Fortran",
  pas: "Pascal", bas: "BASIC", pro: "Prolog", adb: "Ada", ads: "Ada",
  sql: "SQL", sh: "Shell", yml: "YAML", yaml: "YAML", md: "Markdown",
  html: "HTML", css: "CSS", vue: "Vue", svelte: "Svelte",
};

export const KINDS = {
  secret: "Secret",
  danger: "Risk",
  todo: "Note",
  empty: "Empty handler",
  duplicate: "Copy",
  debug: "Debug",
  complexity: "Too complex",
  stale: "Old date",
  license: "License",
};

export const RULES = [
  { id: "aws-access-key", kind: "secret", severity: "high", looksFor: "An AWS access key id (AKIA…)" },
  { id: "private-key", kind: "secret", severity: "high", looksFor: "A PEM private key block" },
  { id: "github-pat", kind: "secret", severity: "high", looksFor: "A GitHub token prefix" },
  { id: "slack-token", kind: "secret", severity: "high", looksFor: "A Slack token prefix" },
  { id: "stripe-live", kind: "secret", severity: "high", looksFor: "A Stripe live secret prefix" },
  { id: "assigned-secret", kind: "secret", severity: "high", looksFor: "A secret, password, or token assigned to a string" },
  { id: "eval", kind: "danger", severity: "high", looksFor: "eval( or new Function(" },
  { id: "html-sink", kind: "danger", severity: "medium", looksFor: "innerHTML, document.write, or dangerouslySetInnerHTML" },
  { id: "pickle", kind: "danger", severity: "high", looksFor: "pickle.load" },
  { id: "yaml-load", kind: "danger", severity: "medium", looksFor: "yaml.load without SafeLoader on the same line" },
  { id: "shell", kind: "danger", severity: "high", looksFor: "shell=True or os.system(" },
  { id: "todo", kind: "todo", severity: "low", looksFor: "TODO, FIXME, HACK, or XXX" },
  { id: "empty-handler", kind: "empty", severity: "medium", looksFor: "An empty catch, or except: pass" },
  { id: "debug", kind: "debug", severity: "low", looksFor: "console.log or debugger" },
  { id: "long-function", kind: "complexity", severity: "medium", looksFor: "A function spanning 80 lines, or 14 decision points" },
  { id: "duplicate", kind: "duplicate", severity: "medium", looksFor: "The same six code lines in two places" },
  { id: "old-copyright", kind: "stale", severity: "low", looksFor: "A copyright year three or more years behind" },
  { id: "no-license", kind: "license", severity: "low", looksFor: "Three or more files and no LICENSE" },
];

const SHAPED = [
  { id: "aws-access-key", re: /\b(AKIA[0-9A-Z]{16})\b/g, title: "AWS access key id" },
  { id: "private-key", re: /(-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----)/g, title: "Private key block" },
  { id: "github-pat", re: /\b(gh[pousr]_[A-Za-z0-9]{20,})\b/g, title: "GitHub token" },
  { id: "slack-token", re: /\b(xox[baprs]-[A-Za-z0-9-]{10,})/g, title: "Slack token" },
  { id: "stripe-live", re: /\b(sk_live_[0-9a-zA-Z]{16,})\b/g, title: "Stripe live secret" },
];

const ASSIGNED = /(?:api[_-]?key|secret|password|passwd|token|private[_-]?key)\s*[:=]\s*['"]([^'"\n]{8,})['"]/gi;

const DANGERS = [
  { id: "eval", re: /\beval\s*\(|\bnew\s+Function\s*\(/, title: "Dynamic code execution", severity: "high", action: "Replace eval or new Function with a parser or an explicit allow-list." },
  { id: "html-sink", re: /\.innerHTML\s*=|dangerouslySetInnerHTML|\bdocument\.write\s*\(/, title: "HTML written from data", severity: "medium", action: "Insert text with textContent, or sanitize with a maintained library before HTML is built." },
  { id: "pickle", re: /\bpickle\.loads?\s*\(/, title: "pickle.load on data", severity: "high", action: "Stop unpickling data you did not just pickle in this process. Use a schema format such as JSON." },
  { id: "shell", re: /\bos\.system\s*\(|\bshell\s*=\s*True\b/, title: "Shell command from the process", severity: "high", action: "Call the program with an argument array and the shell left off." },
];

export function languageOf(path) {
  const base = String(path).split("/").pop() || "";
  const lower = base.toLowerCase();
  if (lower === "dockerfile") return "Docker";
  if (lower === "makefile") return "Make";
  const ext = lower.includes(".") ? lower.split(".").pop() : "";
  return EXT_LANG[ext] || "Text";
}

export function redactSecret(value) {
  const v = String(value || "").trim();
  if (v.length <= 10) return "••••";
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}

export function vigilName(score) {
  if (score >= 90) return "tended";
  if (score >= 75) return "flickering";
  if (score >= 50) return "haunted";
  return "possessed";
}

function isPlaceholder(value) {
  const v = String(value || "").trim();
  if (v.length < 8) return true;
  if (/^(changeme|password|secret|token|example|placeholder|xxx+|your[-_]?key|todo|redacted|none|null|undefined|test|foo|bar|sample)$/i.test(v)) return true;
  if (v.includes("${") || v.includes("process.env") || v.includes("<YOUR")) return true;
  return false;
}

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text.charCodeAt(i) === 10) line += 1;
  return line;
}

function lineText(text, line) {
  return (text.split("\n")[line - 1] || "").trim().slice(0, 180);
}

function push(findings, seen, finding) {
  const key = `${finding.rule}|${finding.file}|${finding.line}`;
  if (seen.has(key)) return;
  seen.add(key);
  findings.push(finding);
}

export function analyze(inputFiles, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const year = now.getUTCFullYear();
  const notes = [];
  const files = [];
  let skipped = 0;

  for (const raw of inputFiles || []) {
    const path = String(raw.path || "untitled.txt").replace(/\\/g, "/").replace(/^\.\//, "");
    if (SKIP.test(`/${path}`)) {
      skipped += 1;
      continue;
    }
    const text = String(raw.text ?? "");
    if (text.includes("\0")) {
      notes.push(`${path} skipped (binary)`);
      skipped += 1;
      continue;
    }
    if (text.length > LIMITS.maxBytes) {
      notes.push(`${path} skipped (over ${LIMITS.maxBytes} bytes)`);
      skipped += 1;
      continue;
    }
    if (files.length >= LIMITS.maxFiles) {
      notes.push(`Stopped after ${LIMITS.maxFiles} files.`);
      skipped += 1;
      continue;
    }
    files.push({ path, text, language: languageOf(path) });
  }

  const findings = [];
  const seen = new Set();
  const languages = {};
  let licenseSeen = false;
  let debugCount = 0;

  for (const file of files) {
    languages[file.language] = (languages[file.language] || 0) + 1;
    if (/(^|\/)(license|licence|copying)(\.[a-z0-9]+)?$/i.test(file.path)) licenseSeen = true;
    scanSecrets(file, findings, seen);
    scanDangers(file, findings, seen);
    scanTodos(file, findings, seen);
    scanEmpty(file, findings, seen);
    debugCount = scanDebug(file, findings, seen, debugCount);
    scanComplexity(file, findings, seen);
    scanCopyright(file, findings, seen, year);
  }
  scanDuplicates(files, findings, seen);

  if (!licenseSeen && files.length >= 3) {
    push(findings, seen, {
      rule: "no-license",
      kind: "license",
      severity: "low",
      file: "(tree)",
      line: 1,
      title: "No LICENSE file",
      evidence: `${files.length} files, no license`,
      action: "Add a license file so the next person knows what they are allowed to do with the tree.",
    });
  }

  const weight = { high: 8, medium: 3, low: 1 };
  const penalty = findings.reduce((sum, f) => sum + (weight[f.severity] || 0), 0);
  let score = Math.max(0, 100 - penalty);
  if (licenseSeen) score = Math.min(100, score + 4);

  const bySeverity = { high: 0, medium: 0, low: 0 };
  for (const f of findings) bySeverity[f.severity] += 1;

  findings.sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 };
    return rank[a.severity] - rank[b.severity] || a.file.localeCompare(b.file) || a.line - b.line;
  });

  const report = {
    score,
    vigil: vigilName(score),
    generatedAt: now.toISOString(),
    files: files.map((f) => ({
      path: f.path,
      language: f.language,
      lines: f.text.split("\n").length,
      bytes: f.text.length,
    })),
    stats: {
      fileCount: files.length,
      skipped,
      findingCount: findings.length,
      bySeverity,
      languages,
      licenseSeen,
    },
    notes,
    findings,
  };
  report.brief = makeBrief(report);
  return report;
}

function fresh(re) {
  return new RegExp(re.source, re.flags);
}

function scanSecrets(file, findings, seen) {
  for (const rule of SHAPED) {
    for (const match of file.text.matchAll(fresh(rule.re))) {
      const token = match[1] || match[0];
      push(findings, seen, {
        rule: rule.id,
        kind: "secret",
        severity: "high",
        file: file.path,
        line: lineOf(file.text, match.index || 0),
        title: rule.title,
        evidence: redactSecret(token),
        localValue: token,
        action: "Remove it from the tree, put it in a secret store, and rotate it if it was ever real.",
      });
    }
  }
  for (const match of file.text.matchAll(fresh(ASSIGNED))) {
    const token = match[1];
    if (isPlaceholder(token)) continue;
    if (/^AKIA[0-9A-Z]{16}$/.test(token) || /^gh[pousr]_/.test(token) || /^sk_live_/.test(token)) continue;
    push(findings, seen, {
      rule: "assigned-secret",
      kind: "secret",
      severity: "high",
      file: file.path,
      line: lineOf(file.text, match.index || 0),
      title: "Secret assigned in source",
      evidence: redactSecret(token),
      localValue: token,
      action: "Read this from the environment or a secret store. Rotate it if the value was ever real.",
    });
  }
}

function scanDangers(file, findings, seen) {
  const lines = file.text.split("\n");
  lines.forEach((line, index) => {
    for (const rule of DANGERS) {
      if (!rule.re.test(line)) continue;
      rule.re.lastIndex = 0;
      push(findings, seen, {
        rule: rule.id,
        kind: "danger",
        severity: rule.severity,
        file: file.path,
        line: index + 1,
        title: rule.title,
        evidence: line.trim().slice(0, 180),
        action: rule.action,
      });
    }
    if (/\byaml\.load\s*\(/.test(line) && !/SafeLoader|safe_load/.test(line)) {
      push(findings, seen, {
        rule: "yaml-load",
        kind: "danger",
        severity: "medium",
        file: file.path,
        line: index + 1,
        title: "yaml.load without a safe loader",
        evidence: line.trim().slice(0, 180),
        action: "Use yaml.safe_load. The plain loader can construct arbitrary objects.",
      });
    }
  });
}

function scanTodos(file, findings, seen) {
  const lines = file.text.split("\n");
  lines.forEach((line, index) => {
    const match = line.match(/(?:^|\s)(TODO|FIXME|HACK|XXX)\b[:\s-]*(.*)$/i);
    if (!match) return;
    const tag = match[1].toUpperCase();
    push(findings, seen, {
      rule: "todo",
      kind: "todo",
      severity: tag === "FIXME" || tag === "HACK" ? "medium" : "low",
      file: file.path,
      line: index + 1,
      title: `${tag} left in the source`,
      evidence: line.trim().slice(0, 180),
      detail: (match[2] || "").trim(),
      action: "Give it an owner and a date, or do the work and remove the note.",
    });
  });
}

function scanEmpty(file, findings, seen) {
  for (const match of file.text.matchAll(/catch\s*(?:\([^)]*\))?\s*\{\s*\}/g)) {
    push(findings, seen, {
      rule: "empty-handler",
      kind: "empty",
      severity: "medium",
      file: file.path,
      line: lineOf(file.text, match.index || 0),
      title: "Empty catch",
      evidence: "catch { }",
      action: "Log it with context, retry a specific failure, or let it surface. An empty catch hides the outage.",
    });
  }
  for (const match of file.text.matchAll(/except\b[^\n]*:\s*\n\s*(?:pass|\.\.\.)\b/g)) {
    push(findings, seen, {
      rule: "empty-handler",
      kind: "empty",
      severity: "medium",
      file: file.path,
      line: lineOf(file.text, match.index || 0),
      title: "Exception swallowed",
      evidence: "except: pass",
      action: "Catch the exception you mean, and record it. A bare pass deletes the failure.",
    });
  }
}

function scanDebug(file, findings, seen, debugCount) {
  const lines = file.text.split("\n");
  lines.forEach((line, index) => {
    if (debugCount >= 12) return;
    if (!/\bconsole\.log\s*\(/.test(line) && !/\bdebugger\b/.test(line)) return;
    debugCount += 1;
    push(findings, seen, {
      rule: "debug",
      kind: "debug",
      severity: "low",
      file: file.path,
      line: index + 1,
      title: /\bdebugger\b/.test(line) ? "debugger statement" : "console.log left in",
      evidence: line.trim().slice(0, 180),
      action: "Remove it, or route it through a logger that stays off in production.",
    });
  });
  return debugCount;
}

function scanComplexity(file, findings, seen) {
  const lines = file.text.split("\n");
  const starts = [];
  const decl = /^(?:export\s+)?(?:async\s+)?function\s+\w+|^(?:export\s+)?(?:const|let|var|def)\s+\w+/;
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (decl.test(trimmed) && (/function\b|->|\bdef\b|=>/.test(trimmed) || trimmed.startsWith("def "))) {
      starts.push(index);
    }
  });
  for (let s = 0; s < starts.length; s++) {
    const from = starts[s];
    const to = s + 1 < starts.length ? starts[s + 1] : lines.length;
    const span = to - from;
    const body = lines.slice(from, to).join("\n");
    const decisions = (body.match(/\b(if|for|while|case|catch|elif|elsif)\b|&&|\|\|/g) || []).length;
    const nameMatch = lines[from].trim().match(/(?:function|def)\s+(\w+)|(?:const|let|var)\s+(\w+)/);
    const name = (nameMatch && (nameMatch[1] || nameMatch[2])) || "function";
    if (span < 80 && decisions < 14) continue;
    push(findings, seen, {
      rule: "long-function",
      kind: "complexity",
      severity: "medium",
      file: file.path,
      line: from + 1,
      title: span >= 80 ? `Long function ${name}` : `Dense branching in ${name}`,
      evidence: `${span} lines, ${decisions} decision points`,
      action: "Split it on the decision that has a name. Leave a comment only where the business rule is not obvious.",
    });
  }
}

function scanCopyright(file, findings, seen, year) {
  const match = file.text.match(/copyright\s*(?:\(c\)|©)?\s*(20\d{2})/i);
  if (!match) return;
  const found = Number(match[1]);
  if (found > year - 3) return;
  push(findings, seen, {
    rule: "old-copyright",
    kind: "stale",
    severity: "low",
    file: file.path,
    line: lineOf(file.text, match.index || 0),
    title: `Copyright year ${found}`,
    evidence: lineText(file.text, lineOf(file.text, match.index || 0)),
    action: "Update the year if the file is still maintained, or treat the date as the last time someone claimed it.",
  });
}

function codeLines(text) {
  return text.split("\n").map((line, index) => ({
    n: index + 1,
    t: line.trim().replace(/\s+/g, " "),
  })).filter((line) => line.t && !/^(\/\/|#|\*|\/\*)/.test(line.t));
}

function hash(value) {
  let h = 5381;
  for (let i = 0; i < value.length; i++) h = ((h << 5) + h) ^ value.charCodeAt(i);
  return (h >>> 0).toString(16);
}

function scanDuplicates(files, findings, seen) {
  const first = new Map();
  const pairs = new Set();
  let reported = 0;
  for (const file of files) {
    const lines = codeLines(file.text);
    for (let i = 0; i + 6 <= lines.length && i < 400; i++) {
      const chunk = lines.slice(i, i + 6);
      const body = chunk.map((line) => line.t).join("\n");
      if (body.length < 80) continue;
      const key = hash(body);
      const loc = { file: file.path, line: chunk[0].n };
      if (!first.has(key)) {
        first.set(key, loc);
        continue;
      }
      const prev = first.get(key);
      if (prev.file === loc.file && Math.abs(prev.line - loc.line) < 6) continue;
      const pair = [prev.file, loc.file].sort().join(" => ");
      if (pairs.has(pair) || reported >= 12) continue;
      pairs.add(pair);
      reported += 1;
      push(findings, seen, {
        rule: "duplicate",
        kind: "duplicate",
        severity: "medium",
        file: loc.file,
        line: loc.line,
        title: "Repeated block",
        evidence: `Same six lines as ${prev.file}:${prev.line}`,
        action: "Keep one copy and call it. Two copies means the next fix lands in only one of them.",
      });
    }
  }
}

function makeBrief(report) {
  const lines = [
    `vigil ${report.score} ${report.vigil}`,
    `files ${report.stats.fileCount}`,
  ];
  for (const finding of report.findings.slice(0, 8)) {
    const evidence = String(finding.evidence || "").replace(/\s+/g, " ").slice(0, 120);
    lines.push(`- ${finding.severity} ${finding.kind} ${finding.file}:${finding.line} ${finding.title}. evidence: ${evidence}. action: ${finding.action}`);
  }
  lines.push("Use only these facts. Do not invent filenames.");
  return lines.join("\n").slice(0, 1600);
}

export function publicReport(report) {
  return {
    ...report,
    findings: report.findings.map(({ localValue, ...rest }) => rest),
  };
}
