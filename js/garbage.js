/**
 * Rejects text a small local model should not be shown as a séance.
 * Silence is better than a loop. Meaning is a separate problem.
 */

export function isGarbage(raw) {
  const t = String(raw || "").trim();
  if (t.length < 24) return true;

  const letters = (t.match(/[A-Za-z]/g) || []).length;
  if (letters / t.length < 0.5) return true;

  if (/(.{1,4})\1{5,}/.test(t)) return true;

  const words = t.toLowerCase().match(/[a-z']+/g) || [];
  if (words.length >= 8) {
    const unique = new Set(words);
    if (unique.size / words.length < 0.35) return true;
    for (let i = 0; i < words.length - 2; i++) {
      if (words[i].length > 2 && words[i] === words[i + 1] && words[i] === words[i + 2]) return true;
    }
  }

  const giant = words.filter((w) => w.length > 28);
  if (giant.length >= 2) return true;

  return false;
}
