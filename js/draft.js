const PROTECTS = {
  secret: "A password in the folder is a real risk.",
  danger: "Code that runs a string it was given can be unsafe.",
  todo: "A note with no owner is easy to forget.",
  empty: "An empty error handler hides the failure.",
  duplicate: "Two copies mean the next fix may land in only one.",
  debug: "A leftover log can print private data.",
  stale: "An old year may not match the file anymore.",
  complexity: "A function this big is hard to change safely.",
  license: "There is no license, so the next person cannot tell what they may do.",
};

export function archivistDraft(report) {
  if (!report || !report.stats) return "";
  const lines = [];
  lines.push(`${report.stats.fileCount} ${report.stats.fileCount === 1 ? "file" : "files"}. Score ${report.score}/100, ${report.vigil}.`);
  if (!report.findings.length) {
    lines.push("No problems from these checks. A quiet folder under this list is not the same as a safe one.");
    lines.push("This text comes from the rules. It does not guess.");
    return lines.join("\n\n");
  }
  const top = report.findings[0];
  lines.push(`The first issue is ${top.title} in ${top.file}, line ${top.line}. ${PROTECTS[top.kind] || ""}`);
  const picked = [];
  for (const finding of report.findings) {
    if (picked.length >= 3) break;
    if (picked.some((item) => item.kind === finding.kind)) continue;
    picked.push(finding);
  }
  for (const finding of report.findings) {
    if (picked.length >= 3) break;
    if (picked.includes(finding)) continue;
    picked.push(finding);
  }
  lines.push(["Do these first:", ...picked.map((finding, index) => `${index + 1}. ${finding.file}:${finding.line} — ${finding.action}`)].join("\n"));
  const vow = report.findings.find((finding) => finding.kind === "todo" && finding.detail);
  const memory = vow
    ? `Keep the note at ${vow.file}:${vow.line}. It says: ${vow.detail}`
    : "Keep the comment that explains a choice. Remove the copies, the keys, and the empty handlers.";
  lines.push(`Keep this: ${memory}`);
  lines.push("This summary comes from the rules. A model may rephrase it. The model must not add files that are not in the list above.");
  return lines.join("\n\n");
}

export function seanceMessages(report) {
  return [
    {
      role: "system",
      content: "You are Veladora, an archivist at a code ofrenda. Rewrite the evidence as a short remembrance for the next maintainer. Use only the files and facts in the user message. Do not invent filenames, owners, or secrets. Plain sentences. Under 140 words.",
    },
    { role: "user", content: report.brief || "" },
  ];
}

export function languageMessages(language, snippet) {
  const body = String(snippet || "").slice(0, 1200);
  return [
    {
      role: "system",
      content: `You explain ${language.name} (${language.born}). ${language.fact} Say what the snippet does, then sketch a modern equivalent in a few lines. If the snippet is not ${language.name}, say so in the first sentence. Do not invent APIs. Under 140 words.`,
    },
    { role: "user", content: body || "(no snippet)" },
  ];
}

export function epitaphMessages(facts) {
  return [
    {
      role: "system",
      content: "Write a four-sentence remembrance. Warm and specific. Use only the facts given. No jokes about death, no costumes, no invented biography. Under 90 words.",
    },
    { role: "user", content: facts },
  ];
}

export function epitaphFallback(facts) {
  const name = facts.name || "Someone";
  const years = facts.years ? ` (${facts.years})` : "";
  const loved = facts.loved ? ` They kept ${facts.loved} close.` : "";
  const story = facts.story ? ` ${facts.story.trim()}` : "";
  return `${name}${years} is on this card.${loved}${story} The work is still here, and the next person still has to read it.`;
}
