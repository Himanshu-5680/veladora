import { KINDS, publicReport } from "./analyzer.js";

function downloadName(report) {
  const day = (report.generatedAt || "").slice(0, 10) || "vigil";
  return `veladora-${day}`;
}

export function toMarkdown(report) {
  const safe = publicReport(report);
  const lines = [
    `# Veladora vigil`,
    ``,
    `Score: **${safe.score}/100** (${safe.vigil})`,
    `Files: ${safe.stats.fileCount}`,
    `Generated: ${safe.generatedAt}`,
    ``,
    `Secret values are redacted. The scan ran in a browser and this file is the part that is safe to paste.`,
    ``,
    `## Findings`,
    ``,
  ];
  if (!safe.findings.length) lines.push("None under these checks.");
  for (const finding of safe.findings) {
    lines.push(`- **${finding.severity}** ${KINDS[finding.kind] || finding.kind}: ${finding.title} (\`${finding.file}:${finding.line}\`)`);
    lines.push(`  - Evidence: ${finding.evidence}`);
    lines.push(`  - Do: ${finding.action}`);
  }
  if (safe.notes.length) {
    lines.push("", "## Notes", "");
    for (const note of safe.notes) lines.push(`- ${note}`);
  }
  return { filename: `${downloadName(safe)}.md`, text: lines.join("\n") };
}

export function toJson(report) {
  const safe = publicReport(report);
  return {
    filename: `${downloadName(safe)}.json`,
    text: JSON.stringify(safe, null, 2),
  };
}

export function toCsv(report) {
  const safe = publicReport(report);
  const header = ["severity", "kind", "file", "line", "title", "evidence", "action"];
  const rows = [header.join(",")];
  for (const finding of safe.findings) {
    rows.push(header.map((key) => csv(finding[key])).join(","));
  }
  return { filename: `${downloadName(safe)}.csv`, text: rows.join("\n") };
}

function csv(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function issueBody(report) {
  const md = toMarkdown(report);
  return {
    title: `Vigil ${report.score}/100 (${report.vigil}): ${report.stats.findingCount} candles`,
    body: `${md.text}\n\nOpened from a local Veladora scan. Secret values in this issue are redacted.\n`,
  };
}
