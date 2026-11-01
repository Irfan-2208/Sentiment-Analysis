import { AlertTriangle, ThumbsUp, ThumbsDown, Lightbulb, ShieldAlert, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Insight {
  summary: string;
  topPraise: string[];
  topComplaints: string[];
  recommendedActions: string[];
  riskLevel: 'low' | 'medium' | 'high';
  riskReason: string;
}

const RISK_CONFIG = {
  low: { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', Icon: TrendingUp, label: 'Low Risk' },
  medium: { color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', Icon: Minus, label: 'Medium Risk' },
  high: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', Icon: TrendingDown, label: 'High Risk' },
};

export function InsightPanel({ insight }: { insight: Insight }) {
  const risk = RISK_CONFIG[insight.riskLevel];
  const RiskIcon = risk.Icon;

  return (
    <section aria-labelledby="insight-heading">
      <h2 id="insight-heading" className="section-title">AI Insight</h2>
      <div className="glass-card space-y-4">
        {/* Summary */}
        <p className="text-sm text-slate-300 leading-relaxed">{insight.summary}</p>

        {/* Risk badge */}
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${risk.bg}`}>
          <RiskIcon className={`w-4 h-4 ${risk.color}`} aria-hidden="true" />
          <div>
            <p className={`text-sm font-semibold ${risk.color}`}>{risk.label}</p>
            <p className="text-xs text-slate-500">{insight.riskReason}</p>
          </div>
        </div>

        {/* Praise */}
        {insight.topPraise.length > 0 && (
          <div>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">
              <ThumbsUp className="w-3.5 h-3.5" aria-hidden="true" />
              Top Praise
            </h3>
            <ul className="space-y-1.5">
              {insight.topPraise.map((p, i) => (
                <li key={i} className="text-sm text-slate-400 pl-3 border-l border-emerald-500/30">{p}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Complaints */}
        {insight.topComplaints.length > 0 && (
          <div>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">
              <ThumbsDown className="w-3.5 h-3.5" aria-hidden="true" />
              Top Complaints
            </h3>
            <ul className="space-y-1.5">
              {insight.topComplaints.map((c, i) => (
                <li key={i} className="text-sm text-slate-400 pl-3 border-l border-red-500/30">{c}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        {insight.recommendedActions.length > 0 && (
          <div>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold text-brand-400 uppercase tracking-wider mb-2">
              <Lightbulb className="w-3.5 h-3.5" aria-hidden="true" />
              Recommended Actions
            </h3>
            <ol className="space-y-1.5 list-decimal list-inside">
              {insight.recommendedActions.map((a, i) => (
                <li key={i} className="text-sm text-slate-400">{a}</li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}
