import type { AnalysisStats } from '@social-pulse/shared';
import { TrendingUp, TrendingDown, Minus, Zap, AlertTriangle, MessageSquare, Globe } from 'lucide-react';

function KPI({ label, value, sub, icon: Icon, colorClass }: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  colorClass: string;
}) {
  return (
    <div className="kpi-card">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClass}`}>
          <Icon className="w-4 h-4" aria-hidden="true" />
        </div>
      </div>
      <p className="text-3xl font-bold text-slate-100 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

export function SentimentOverview({ stats }: { stats: AnalysisStats }) {
  const { sentimentPercentages: pct, averageScore, totalAnalyzed, sarcasticCount, toxicCount, totalFetched, totalDeduplicated, totalSpamRemoved } = stats;

  const scoreColor = averageScore > 0.15 ? 'text-emerald-400' : averageScore < -0.15 ? 'text-red-400' : 'text-cyan-400';
  const ScoreIcon = averageScore > 0.15 ? TrendingUp : averageScore < -0.15 ? TrendingDown : Minus;

  return (
    <section aria-labelledby="overview-heading">
      <h2 id="overview-heading" className="section-title">Overview</h2>

      {/* Stats strip */}
      <div className="text-xs text-slate-500 mb-4 flex flex-wrap gap-4">
        <span>Fetched: <strong className="text-slate-300">{totalFetched}</strong></span>
        <span>Deduplicated: <strong className="text-slate-300">{totalDeduplicated}</strong></span>
        <span>Spam removed: <strong className="text-slate-300">{totalSpamRemoved}</strong></span>
        <span>Analyzed: <strong className="text-slate-300">{totalAnalyzed}</strong></span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPI
          label="Positive"
          value={`${pct.positive}%`}
          sub={`${Math.round((pct.positive / 100) * totalAnalyzed)} comments`}
          icon={TrendingUp}
          colorClass="bg-emerald-500/15 text-emerald-400"
        />
        <KPI
          label="Negative"
          value={`${pct.negative}%`}
          sub={`${Math.round((pct.negative / 100) * totalAnalyzed)} comments`}
          icon={TrendingDown}
          colorClass="bg-red-500/15 text-red-400"
        />
        <KPI
          label="Avg Score"
          value={averageScore.toFixed(2)}
          sub="Range: -1 to +1"
          icon={ScoreIcon}
          colorClass={`${averageScore > 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}
        />
        <KPI
          label="Neutral"
          value={`${pct.neutral}%`}
          sub={`${sarcasticCount} sarcastic`}
          icon={MessageSquare}
          colorClass="bg-cyan-500/15 text-cyan-400"
        />
      </div>

      {/* Secondary row */}
      {(toxicCount > 0 || sarcasticCount > 0) && (
        <div className="mt-4 flex gap-3">
          {toxicCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl glass text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-400" aria-hidden="true" />
              <span className="text-slate-400">{toxicCount} toxic comments detected</span>
            </div>
          )}
          {sarcasticCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl glass text-sm">
              <Zap className="w-4 h-4 text-purple-400" aria-hidden="true" />
              <span className="text-slate-400">{sarcasticCount} sarcastic comments detected</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
