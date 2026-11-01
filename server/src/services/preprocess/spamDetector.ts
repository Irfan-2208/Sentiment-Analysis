/**
 * Heuristic spam detector for YouTube comments.
 * Flags comments that match promotional patterns.
 * Does NOT alter comments — only returns a boolean flag.
 *
 * Fixes applied (B5):
 *  - Use \p{Extended_Pictographic} (not \p{Emoji}) to avoid matching ASCII digits.
 *  - Use Intl.Segmenter for grapheme-cluster length so multi-codepoint emoji like 👍🏽 count as 1.
 *  - Short sentiment-bearing words ("ok", "wow", "meh", "वाह", "👍") are NOT spam.
 *  - Elongation ("soooooo", "bhaaaai") is NOT spam — treated as intensity; only flag 10+ identical chars.
 *  - Only strong promo/sub4sub/url signals qualify as spam.
 */

// ─── Patterns ─────────────────────────────────────────────────────────────────

const URL_PATTERN = /https?:\/\/[^\s]+|www\.[^\s]+\.[a-z]{2,}/i;
const SUB4SUB_PATTERN = /\bsub\s*4\s*sub\b|\bsub\s*for\s*sub\b/i;
const PROMO_PATTERN =
  /\b(free\s+subscribers?|follow\s+back|check\s+my\s+(channel|bio)|click\s+(here|link)|limited\s+(time|spots?)|make\s+money\s+online|earn\s+\$|free\s+gift|subscribe\s+(for|and|to\s+win)|join\s+my\s+channel|visit\s+my\s+channel|crypto\s+giveaway|drop\s+your\s+(channel|link)|check\s+out\s+my)\b/i;

// Identical char repeated 10+ times in a row (clearly spam/broken keyboard), NOT 5-9 which can be elongation
const EXCESSIVE_REPETITION_PATTERN = /(.)\1{9,}/;

// Same word repeated 4+ times ("sub sub sub sub sub")
const WORD_FLOOD_PATTERN = /\b(\w{2,})\b(?:\s+\1){3,}/i;

// Excessive punctuation only (10+ in a row of just ! or ? — clearly spam, not excitement)
const PURE_PUNCT_SPAM_PATTERN = /^[!?]{10,}$/;

// ─── Grapheme cluster length ──────────────────────────────────────────────────

let _segmenter: Intl.Segmenter | null = null;
function getSegmenter(): Intl.Segmenter | null {
  if (_segmenter !== null) return _segmenter;
  try {
    _segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return _segmenter;
  } catch {
    return null;
  }
}

function graphemeLength(text: string): number {
  const seg = getSegmenter();
  if (!seg) return text.length; // fallback: codeunit length
  return [...seg.segment(text)].length;
}

// ─── Extended pictographic emoji check ───────────────────────────────────────
// \p{Extended_Pictographic} matches real emoji but NOT ASCII digits (unlike \p{Emoji}).

const EXTENDED_PICTOGRAPHIC = /\p{Extended_Pictographic}/u;

function hasPictographicEmoji(text: string): boolean {
  return EXTENDED_PICTOGRAPHIC.test(text);
}

// ─── Main spam check ─────────────────────────────────────────────────────────

/**
 * Returns true if the comment should be flagged as spam.
 * Spam comments are EXCLUDED from sentiment totals.
 *
 * IMPORTANT: Short comments and emoji-only comments are NOT spam.
 * We only flag strong promotional / flood / URL signals.
 */
export function isSpam(normalizedText: string): boolean {
  if (!normalizedText) return false;

  const trimmed = normalizedText.trim();
  if (!trimmed) return false;

  // Measure length in grapheme clusters (handles multi-codepoint emoji correctly)
  const glength = graphemeLength(trimmed);

  // Empty after trim — not meaningful, but also not "spam" in the promo sense
  if (glength === 0) return false;

  // Very short comments (≤3 grapheme clusters) that contain at least one pictographic emoji
  // are valid sentiment signals ("👍", "❤️", "🔥👏") — NOT spam
  // Short text without emoji is also allowed (e.g. "ok", "wow", "meh", "वाह")
  // We only block if it's a non-emoji string of 0 chars (caught above)
  if (glength <= 3) {
    // Never spam short text — it can be sentiment-bearing
    return false;
  }

  // Contains external URL → spam
  if (URL_PATTERN.test(trimmed)) return true;

  // Sub4sub patterns → spam
  if (SUB4SUB_PATTERN.test(trimmed)) return true;

  // Promotional phrases → spam
  if (PROMO_PATTERN.test(trimmed)) return true;

  // Same char repeated 10+ times (not elongation, clearly a keyboard smash or flood)
  if (EXCESSIVE_REPETITION_PATTERN.test(trimmed)) return true;

  // Same word repeated 4+ times in a row
  if (WORD_FLOOD_PATTERN.test(trimmed)) return true;

  // Entire comment is just 5+ ! or ? marks
  if (PURE_PUNCT_SPAM_PATTERN.test(trimmed)) return true;

  return false;
}

/**
 * Processes a list of normalized texts and returns spam flags.
 */
export function flagSpam(comments: Array<{ normalizedText: string }>): boolean[] {
  return comments.map((c) => isSpam(c.normalizedText));
}

// Re-export for tests
export { hasPictographicEmoji };
