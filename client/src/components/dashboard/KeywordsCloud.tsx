import type { KeywordStat } from '@social-pulse/shared';

export function KeywordsCloud({ keywords }: { keywords: KeywordStat[] }) {
  if (!keywords.length) return null;

  const maxCount = Math.max(...keywords.map((k) => k.count));

  return (
    <section aria-labelledby="keywords-heading">
      <h2 id="keywords-heading" className="section-title">Top Keywords</h2>
      <div className="glass-card">
        <div className="flex flex-wrap gap-2">
          {keywords.map((kw) => {
            const size = 0.75 + (kw.count / maxCount) * 0.75; // 0.75rem → 1.5rem
            const positiveRatio = kw.positive / (kw.count || 1);
            const negativeRatio = kw.negative / (kw.count || 1);
            const colorClass =
              positiveRatio > 0.6
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                : negativeRatio > 0.6
                ? 'bg-red-500/15 text-red-400 border-red-500/20'
                : 'bg-white/5 text-slate-400 border-white/10';

            return (
              <span
                key={kw.keyword}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-medium transition-all hover:scale-105 cursor-default ${colorClass}`}
                style={{ fontSize: `${size}rem` }}
                title={`${kw.count} comments | ${kw.positive} positive · ${kw.negative} negative · ${kw.neutral} neutral`}
                aria-label={`${kw.keyword}: ${kw.count} mentions`}
              >
                {kw.keyword}
                <span className="text-xs opacity-60">({kw.count})</span>
              </span>
            );
          })}
        </div>

        {/* Mini legend */}
        <div className="flex gap-4 mt-4 pt-4 border-t border-white/5 text-xs text-slate-600">
          <span className="text-emerald-600">■ Positive keywords</span>
          <span className="text-red-600">■ Negative keywords</span>
          <span className="text-slate-600">■ Mixed/neutral</span>
        </div>
      </div>
    </section>
  );
}
