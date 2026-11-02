import { AlertTriangle } from 'lucide-react';

export function RatingMismatchBanner({
  mismatchCount,
  onFilterMismatch,
}: {
  mismatchCount: number;
  onFilterMismatch?: () => void;
}) {
  if (!mismatchCount || mismatchCount <= 0) return null;

  return (
    <div className="w-full bg-amber-500/10 border border-amber-500/30 text-amber-200 rounded-xl p-4 flex items-center justify-between flex-wrap gap-4 text-sm shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div>
          <p className="font-semibold text-amber-200">
            {mismatchCount} Rating vs. Text Mismatches Detected
          </p>
          <p className="text-xs text-amber-300/80">
            Found reviews where star ratings clash with sentiment (e.g. 1-star reviews with sarcastic praise or 5-star reviews reporting severe defects).
          </p>
        </div>
      </div>

      {onFilterMismatch && (
        <button
          onClick={onFilterMismatch}
          className="btn-secondary text-xs py-1.5 px-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border-amber-500/40 transition-colors whitespace-nowrap"
        >
          View Mismatched Reviews →
        </button>
      )}
    </div>
  );
}

