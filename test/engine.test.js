import assert from "node:assert/strict";
import test from "node:test";
import { analyze, publicReport, redactSecret } from "../js/analyzer.js";
import { archivistDraft, seanceMessages } from "../js/draft.js";
import { toJson, toMarkdown } from "../js/export.js";
import { isGarbage } from "../js/garbage.js";
import { sampleFiles } from "../js/samples.js";
import { parseGitLog } from "../js/timeline.js";

test("redacts a credential and keeps a short value hidden", () => {
  assert.equal(redactSecret("AKIAIOSFODNN7EXAMPLE"), "AKIA…MPLE");
  assert.equal(redactSecret("short"), "••••");
});

test("flags a real-shaped key and ignores a placeholder password", () => {
  const report = analyze([
    {
      path: "src/config.js",
      text: `const AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE";\nconst password = "changeme";\n`,
    },
  ]);
  assert.equal(report.findings.filter((f) => f.kind === "secret").length, 1);
  assert.equal(report.findings[0].line, 1);
  assert.equal(report.findings[0].evidence.includes("AKIAIOSFODNN7EXAMPLE"), false);
  assert.equal(report.brief.includes("AKIAIOSFODNN7EXAMPLE"), false);
});

test("sees the unfinished vow, the open door, and the empty cup", () => {
  const report = analyze([
    {
      path: "src/pay.js",
      text: "function quote(note) {\n  // FIXME: holiday rates have been wrong since the 2019 contract\n  try { return eval(note); } catch (err) {}\n}\n",
    },
  ]);
  const rules = report.findings.map((f) => f.rule);
  assert.ok(rules.includes("todo"));
  assert.ok(rules.includes("eval"));
  assert.ok(rules.includes("empty-handler"));
  assert.equal(report.findings.find((f) => f.rule === "todo").line, 2);
});

test("catches pickle, a bare pass, and unsafe yaml", () => {
  const report = analyze([
    {
      path: "scripts/migrate.py",
      text: "import pickle, yaml\ndef load_shift(path):\n    try:\n        return pickle.load(path)\n    except Exception:\n        pass\ndef read_rules(text):\n    return yaml.load(text)\n",
    },
  ]);
  const rules = report.findings.map((f) => f.rule);
  assert.ok(rules.includes("pickle"));
  assert.ok(rules.includes("empty-handler"));
  assert.ok(rules.includes("yaml-load"));
});

test("notices a repeated block and skips dependencies", () => {
  const block = "function formatMoney(cents) {\n  const sign = cents < 0 ? '-' : '';\n  const abs = Math.abs(cents);\n  const dollars = Math.floor(abs / 100);\n  const rem = String(abs % 100).padStart(2, '0');\n  return sign + dollars + '.' + rem;\n}\n";
  const report = analyze([
    { path: "src/money.js", text: block },
    { path: "src/money-again.js", text: block },
    { path: "node_modules/left-pad/index.js", text: "eval('nope')\n" },
  ]);
  assert.equal(report.findings.some((f) => f.rule === "duplicate"), true);
  assert.equal(report.findings.some((f) => f.file.includes("node_modules")), false);
  assert.equal(report.stats.skipped, 1);
});

test("a long function is a long night, and a license steadies the score", () => {
  const body = `function settle(rows) {\n${"  if (rows) total += 1;\n".repeat(90)}}\n`;
  const bare = analyze([{ path: "src/settle.js", text: body }]);
  const licensed = analyze([
    { path: "src/settle.js", text: body },
    { path: "LICENSE", text: "MIT\n" },
  ]);
  assert.equal(bare.findings.some((f) => f.rule === "long-function"), true);
  assert.ok(licensed.score > bare.score);
});

test("the sample is haunted, exportable, and free of raw secrets", () => {
  const report = analyze(sampleFiles(), { now: "2026-10-31T00:00:00.000Z" });
  assert.ok(report.score >= 20 && report.score <= 80, `score ${report.score}`);
  assert.equal(report.vigil === "haunted" || report.vigil === "possessed", true);
  const json = toJson(report).text;
  assert.equal(json.includes("AKIAIOSFODNN7EXAMPLE"), false);
  assert.equal(json.includes("localValue"), false);
  assert.equal(json.includes("wJalrXUtnFEMI"), false);
  const markdown = toMarkdown(report).text;
  assert.match(markdown, /Score:/);
  const draft = archivistDraft(report);
  assert.match(draft, /src\/config\.js/);
  const messages = seanceMessages(report);
  assert.equal(messages[1].content.includes("AKIAIOSFODNN7EXAMPLE"), false);
  assert.equal(publicReport(report).findings.every((f) => !("localValue" in f)), true);
});

test("a quiet file is not called safe, only quiet under these checks", () => {
  const report = analyze([{ path: "src/ok.js", text: "export const answer = 42;\n" }]);
  assert.equal(report.score, 100);
  assert.match(archivistDraft(report), /not the same as a safe one/);
});

test("garbage filter keeps loops off the altar", () => {
  assert.equal(isGarbage("u.u.u.u.u.u.u.u.u.u.u.u"), true);
  assert.equal(isGarbage("The holiday rate is still the 2019 contract, and the key has to leave the tree before anyone else clones it."), false);
});

test("a pasted git log becomes a timeline and ignores a bad line", () => {
  const parsed = parseGitLog("abc1234\tAda Lovelace\t2020-01-02\tfirst light\nbad line\nfff9999\tAda Lovelace\t2024-05-01\trotate the key\n");
  assert.equal(parsed.commits.length, 2);
  assert.equal(parsed.authors[0].name, "Ada Lovelace");
  assert.equal(parsed.authors[0].commits, 2);
  assert.equal(parsed.authors[0].first, "2020-01-02");
  assert.equal(parsed.skipped, 1);
});
