/**
 * Reads a git log that was pasted locally.
 * Expected command:
 * git log --date=short --pretty=format:%h%x09%an%x09%ad%x09%s
 */

export function parseGitLog(text) {
  const commits = [];
  const skipped = [];
  const byAuthor = new Map();

  for (const raw of String(text || "").split(/\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split("\t");
    if (parts.length < 4) {
      skipped.push(line.slice(0, 80));
      continue;
    }
    const [hash, author, date, ...rest] = parts;
    const subject = rest.join("\t").trim();
    if (!/^[0-9a-f]{4,40}$/i.test(hash) || !author || !/^\d{4}-\d{2}-\d{2}/.test(date)) {
      skipped.push(line.slice(0, 80));
      continue;
    }
    const commit = { hash, author, date: date.slice(0, 10), subject };
    commits.push(commit);
    if (!byAuthor.has(author)) byAuthor.set(author, []);
    byAuthor.get(author).push(commit);
  }

  const authors = [...byAuthor.entries()]
    .map(([name, list]) => {
      const ordered = [...list].sort((a, b) => a.date.localeCompare(b.date) || a.hash.localeCompare(b.hash));
      return {
        name,
        commits: list.length,
        first: ordered[0].date,
        last: ordered[ordered.length - 1].date,
        subjects: [...ordered].reverse().slice(0, 3).map((c) => c.subject).filter(Boolean),
      };
    })
    .sort((a, b) => b.commits - a.commits || a.name.localeCompare(b.name));

  return { commits, authors, skipped: skipped.length };
}
