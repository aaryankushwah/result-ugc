export type DiffToken = { text: string; state: "same" | "added" | "removed" };

const TOKEN = /\s+|[^\s]+/g;

function tokenize(value: string): string[] {
  return value.match(TOKEN) ?? [];
}

function isWhitespace(token: string): boolean {
  return /^\s+$/.test(token);
}

/** Comparison key: case- and punctuation-insensitive so "Result." matches "result". */
function key(token: string): string {
  return token.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/**
 * Word-level diff between the source transcript and the generated script.
 * Powers the studio highlight that proves only business terms changed.
 * Longest-common-subsequence over token keys, whitespace-preserving.
 */
export function diffWords(before: string, after: string): DiffToken[] {
  const source = tokenize(before);
  const target = tokenize(after);

  const sourceWords = source.filter((token) => !isWhitespace(token));
  const targetWords = target.filter((token) => !isWhitespace(token));

  const rows = sourceWords.length;
  const columns = targetWords.length;
  // table[i][j] = LCS length of sourceWords[i..] and targetWords[j..]
  const table: number[][] = Array.from({ length: rows + 1 }, () => new Array<number>(columns + 1).fill(0));
  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = columns - 1; j >= 0; j -= 1) {
      const row = table[i]!;
      const next = table[i + 1]!;
      row[j] = key(sourceWords[i]!) === key(targetWords[j]!) ? next[j + 1]! + 1 : Math.max(next[j]!, row[j + 1]!);
    }
  }

  const tokens: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < rows && j < columns) {
    if (key(sourceWords[i]!) === key(targetWords[j]!)) {
      tokens.push({ text: targetWords[j]!, state: "same" });
      i += 1;
      j += 1;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      tokens.push({ text: sourceWords[i]!, state: "removed" });
      i += 1;
    } else {
      tokens.push({ text: targetWords[j]!, state: "added" });
      j += 1;
    }
  }
  while (i < rows) { tokens.push({ text: sourceWords[i]!, state: "removed" }); i += 1; }
  while (j < columns) { tokens.push({ text: targetWords[j]!, state: "added" }); j += 1; }

  return tokens;
}

/** Fraction of the source that survived verbatim. The studio surfaces this as "N% preserved". */
export function preservedRatio(tokens: DiffToken[]): number {
  const kept = tokens.filter((token) => token.state === "same").length;
  const original = tokens.filter((token) => token.state !== "added").length;
  if (original === 0) return 1;
  return kept / original;
}
