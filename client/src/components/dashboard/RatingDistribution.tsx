import { Star } from 'lucide-react';

export function RatingDistribution({
  distribution,
}: {
  distribution: { 1: number; 2: number; 3: number; 4: number; 5: number };
}) {
  const total =
    (distribution[1] || 0) +
    (distribution[2] || 0) +
    (distribution[3] || 0) +
    (distribution[4] || 0) +
    (distribution[5] || 0);

  if (total === 0) return null;

  const weightedSum =
    (distribution[1] || 0) * 1 +
    (distribution[2] || 0) * 2 +
    (distribution[3] || 0) * 3 +
    (distribution[4] || 0) * 4 +
    (distribution[5] || 0) * 5;

  const averageRating = (weightedSum / total).toFixed(1);

  const starRows = [5, 4, 3, 2, 1] as const;

  return (
    <div className="glass-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-200">Customer Rating Breakdown</h3>
        <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-lg text-emerald-400 font-bold text-sm">
          <Star className="w-4 h-4 fill-emerald-400" />
          <span>{averageRating}</span>
          <span className="text-xs text-slate-400 font-normal">/ 5.0</span>
        </div>
      </div>

      <div className="space-y-2">
        {starRows.map((stars) => {
          const count = distribution[stars] || 0;
          const pct = Math.round((count / total) * 100);

          let barColor = 'bg-emerald-500';
          if (stars === 3) barColor = 'bg-amber-500';
          if (stars <= 2) barColor = 'bg-red-500';

          return (
            <div key={stars} className="flex items-center gap-3 text-xs">
              <span className="w-8 text-slate-400 font-medium flex items-center gap-0.5 justify-end">
                {stars} <Star className="w-3 h-3 fill-slate-400 inline" />
              </span>

              <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full ${barColor} rounded-full transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <span className="w-12 text-right text-slate-300 font-mono">
                {count.toLocaleString()}
              </span>

              <span className="w-9 text-right text-slate-500">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-right text-xs text-slate-500">
        Based on {total.toLocaleString()} rated reviews
      </div>
    </div>
  );
}

