import { ThumbsUp, ThumbsDown, CheckCircle2, XCircle } from 'lucide-react';

export function ProsConsList({
  topPros,
  topCons,
}: {
  topPros?: string[];
  topCons?: string[];
}) {
  const hasPros = topPros && topPros.length > 0;
  const hasCons = topCons && topCons.length > 0;

  if (!hasPros && !hasCons) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Pros */}
      <div className="glass-card border-emerald-500/20 bg-emerald-500/[0.03]">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ThumbsUp className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-emerald-300">Top Pros</h3>
            <p className="text-[11px] text-slate-400">Key positive themes from verified buyers</p>
          </div>
        </div>

        {hasPros ? (
          <ul className="space-y-2">
            {topPros.map((pro, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                <span className="capitalize">{pro}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-500 italic">No prominent pros detected.</p>
        )}
      </div>

      {/* Cons */}
      <div className="glass-card border-red-500/20 bg-red-500/[0.03]">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400">
            <ThumbsDown className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-red-300">Top Cons</h3>
            <p className="text-[11px] text-slate-400">Common complaints & dissatisfaction</p>
          </div>
        </div>

        {hasCons ? (
          <ul className="space-y-2">
            {topCons.map((con, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                <span className="capitalize">{con}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-500 italic">No prominent cons detected.</p>
        )}
      </div>
    </div>
  );
}

