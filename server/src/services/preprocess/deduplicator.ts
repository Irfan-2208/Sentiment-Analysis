import type { ProcessedComment } from './normalizer.js';

export interface DedupeResult {
  unique: ProcessedComment[];
  /** Map from externalId of duplicate → externalId of canonical comment */
  duplicateMap: Map<string, string>;
  /** Map from canonical externalId → count of duplicates seen */
  duplicateCounts: Map<string, number>;
}

/**
 * Deduplicates comments by normalized-text hash.
 * When duplicates exist, keeps the instance with the highest likeCount.
 * Tracks duplicate relationships for reporting.
 *
 * B6 fix: when a new comment with higher likeCount replaces the existing canonical,
 * we migrate the old canonical's duplicate count to the new canonical so the chain
 * is not broken (earlier duplicates still point at a valid canonical id).
 */
export function deduplicateComments(comments: ProcessedComment[]): DedupeResult {
  const hashMap = new Map<string, ProcessedComment>();
  const duplicateMap = new Map<string, string>();
  const duplicateCounts = new Map<string, number>();

  for (const comment of comments) {
    const existing = hashMap.get(comment.hash);

    if (!existing) {
      // First time seeing this hash — it's the canonical for now
      hashMap.set(comment.hash, comment);
      duplicateCounts.set(comment.externalId, 0);
    } else {
      // Seen before — keep highest likeCount as canonical
      const newIsHigher = comment.likeCount > existing.likeCount;
      const canonical = newIsHigher ? comment : existing;
      const duplicate = newIsHigher ? existing : comment;

      if (newIsHigher) {
        // The old canonical is being demoted to a duplicate.
        // Transfer its accumulated duplicate count to the new canonical.
        const oldCount = duplicateCounts.get(existing.externalId) ?? 0;
        duplicateCounts.delete(existing.externalId);
        duplicateCounts.set(canonical.externalId, oldCount + 1); // +1 for the old canonical itself

        // All existing duplicates that pointed at the old canonical now point at the new canonical.
        for (const [dupId, canonId] of duplicateMap.entries()) {
          if (canonId === existing.externalId) {
            duplicateMap.set(dupId, canonical.externalId);
          }
        }

        // The old canonical is now a duplicate of the new canonical
        duplicateMap.set(duplicate.externalId, canonical.externalId);
      } else {
        // existing stays canonical — increment its count
        const prevCount = duplicateCounts.get(canonical.externalId) ?? 0;
        duplicateCounts.set(canonical.externalId, prevCount + 1);
        duplicateMap.set(duplicate.externalId, canonical.externalId);
      }

      hashMap.set(comment.hash, canonical);
    }
  }

  return {
    unique: Array.from(hashMap.values()),
    duplicateMap,
    duplicateCounts,
  };
}
