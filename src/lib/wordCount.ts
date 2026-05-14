/**
 * Word-count rule (plan / todo: word-count-rules):
 * - `trim` the selection
 * - split on one-or-more whitespace (`/\s+/`)
 * - drop empty segments
 *
 * Notes:
 * - Hyphenated words stay one token (no split on hyphen).
 * - Punctuation attached to a word stays with that token (e.g. "hello," → one token).
 * - Not a linguistic tokenizer; good default for the 1-word vs multi-word branch.
 */
export function countWordsForBranching(text: string): number {
  const t = text.trim()
  if (!t) return 0
  return t.split(/\s+/).filter(Boolean).length
}
