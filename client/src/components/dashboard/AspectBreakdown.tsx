import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Star } from 'lucide-react';
import type { AspectStat, AspectRatingStat } from '@social-pulse/shared';

export function AspectBreakdown({
  aspects,
  aspectRatingStats,
}: {
  aspects: AspectStat[];
  aspectRatingStats?: AspectRatingStat[];
}) {
  const data = aspects.slice(0, 10).map((a) => {
    const ratingStat = aspectRatingStats?.find((r) => r.aspect === a.aspect);
    return {
      aspect: a.aspect,
      positive: a.positive,
      negative: a.negative,
      neutral: a.neutral,
      total: a.total,
      net: a.positive - a.negative,
      avgRating: ratingStat?.avgRating,
    };
  });

  const hasRatings = Boolean(aspectRatingStats && aspectRatingStats.length > 0);

  return (
    <section aria-labelledby="aspects-heading">
      <div className="flex items-center justify-between mb-3">
        <h2 id="aspects-heading" className="section-title mb-0">Aspect Sentiment Analysis</h2>
        {hasRatings && (
          <span className="text-xs text-slate-400">Includes aspect-level star ratings</span>
        )}
      </div>

      <div className="glass-card">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
            <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis
              dataKey="aspect"
              type="category"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={90}
            />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
              formatter={(value, name) => [value, name]}
            />
            <Bar dataKey="positive" name="Positive" fill="#10b981" radius={[0, 4, 4, 0]} />
            <Bar dataKey="negative" name="Negative" fill="#ef4444" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>

        {hasRatings && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5">
              Aspect Rating Summary
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {aspectRatingStats?.slice(0, 8).map((ar) => (
                <div
                  key={ar.aspect}
                  className="bg-white/[0.02] border border-white/5 rounded-lg p-2 flex items-center justify-between text-xs"
                >
                  <span className="capitalize font-medium text-slate-300">{ar.aspect}</span>
                  <span
                    className={`inline-flex items-center gap-0.5 font-bold ${
                      (ar.avgRating ?? 0) >= 4
                        ? 'text-emerald-400'
                        : (ar.avgRating ?? 0) >= 3
                          ? 'text-amber-400'
                          : 'text-red-400'
                    }`}
                  >
                    {(ar.avgRating ?? 0).toFixed(1)} <Star className="w-3 h-3 fill-current inline" />
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
