import { useState } from 'react';
import { useAnalyses, useCompare } from '../api/hooks';
import { GitCompare, TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';
import type { Analysis } from '@social-pulse/shared';

function DeltaBadge({ value }: { value: number }) {
  const abs = Math.abs(value).toFixed(1);
  if (Math.abs(value) < 0.5) return <span className="text-slate-500 text-sm">≈ 0</span>;
  if (value > 0) return <span className="flex items-center gap-1 text-emerald-400 text-sm font-semibold"><TrendingUp className="w-3.5 h-3.5" />+{abs}</span>;
  return <span className="flex items-center gap-1 text-red-400 text-sm font-semibold"><TrendingDown className="w-3.5 h-3.5" />−{abs}</span>;
}

export function ComparePage() {
  const [idA, setIdA] = useState('');
  const [idB, setIdB] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const { data: analysesData } = useAnalyses({ status: 'done', limit: '50' });
  const { data: comparison, isLoading, error } = useCompare(
    submitted ? idA : undefined,
    submitted ? idB : undefined
  );

  const doneAnalyses = (analysesData?.data ?? []) as Analysis[];

  const handleCompare = (e: React.FormEvent) => {
    e.preventDefault();
    if (idA && idB && idA !== idB) setSubmitted(true);
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Compare Analyses</h1>
        <p className="text-sm text-slate-500">Select two completed analyses to compare their sentiment side by side.</p>
      </div>

      {/* Selector form */}
      <form onSubmit={handleCompare} className="glass-card mb-8" aria-label="Compare two analyses">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-4 items-end">
          <div>
            <label htmlFor="analysis-a" className="block text-xs text-slate-400 mb-1.5">Analysis A</label>
            <select
              id="analysis-a"
              value={idA}
              onChange={(e) => { setIdA(e.target.value); setSubmitted(false); }}
              className="input-base text-sm"
              required
            >
              <option value="">Select analysis…</option>
              {doneAnalyses.filter((a) => a.id !== idB).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.videoMeta?.title?.slice(0, 50) ?? a.url.slice(0, 50)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-center pb-1">
            <ArrowRight className="w-5 h-5 text-slate-600" aria-hidden="true" />
          </div>

          <div>
            <label htmlFor="analysis-b" className="block text-xs text-slate-400 mb-1.5">Analysis B</label>
            <select
              id="analysis-b"
              value={idB}
              onChange={(e) => { setIdB(e.target.value); setSubmitted(false); }}
              className="input-base text-sm"
              required
            >
              <option value="">Select analysis…</option>
              {doneAnalyses.filter((a) => a.id !== idA).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.videoMeta?.title?.slice(0, 50) ?? a.url.slice(0, 50)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          className="btn-primary mt-4"
          disabled={!idA || !idB || idA === idB || isLoading}
          aria-label="Run comparison"
        >
          <GitCompare className="w-4 h-4" />
          {isLoading ? 'Comparing…' : 'Compare'}
        </button>

        {doneAnalyses.length === 0 && (
          <p className="mt-3 text-xs text-slate-500">No completed analyses yet. Run at least two analyses to compare.</p>
        )}
      </form>

      {/* Results */}
      {error && (
        <div className="glass-card text-red-400 text-sm">Failed to load comparison: {(error as Error).message}</div>
      )}

      {comparison && (
        <div className="space-y-6 animate-slide-up">
          {/* Side by side headers */}
          <div className="grid grid-cols-2 gap-4">
            {[comparison.a, comparison.b].map((analysis: Analysis, i: number) => (
              <div key={i} className="glass-card">
                <div className="text-xs text-slate-500 mb-1">Analysis {i === 0 ? 'A' : 'B'}</div>
                <p className="text-sm font-semibold text-slate-200 line-clamp-2">
                  {analysis.videoMeta?.title ?? analysis.url}
                </p>
                {analysis.stats && (
                  <div className="mt-2 text-xs text-slate-500">
                    {analysis.stats.totalAnalyzed} comments analyzed
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Delta table */}
          <div className="glass-card">
            <h2 className="text-lg font-bold mb-4">Difference (B − A)</h2>
            <div className="space-y-3">
              {[
                { label: 'Average Score', key: 'averageScore', unit: '' },
                { label: 'Positive %', key: 'positivePercent', unit: '%' },
                { label: 'Negative %', key: 'negativePercent', unit: '%' },
                { label: 'Neutral %', key: 'neutralPercent', unit: '%' },
                { label: 'Total Analyzed', key: 'totalAnalyzed', unit: '' },
                { label: 'Sarcastic', key: 'sarcasticCount', unit: '' },
                { label: 'Toxic', key: 'toxicCount', unit: '' },
              ].map(({ label, key }) => (
                <div key={key} className="flex items-center gap-4">
                  <span className="text-sm text-slate-400 w-36 flex-shrink-0">{label}</span>
                  <div className="flex-1 h-px bg-white/5" />
                  <DeltaBadge value={comparison.delta[key] ?? 0} />
                </div>
              ))}
            </div>
          </div>

          {/* Side-by-side stats */}
          <div className="grid grid-cols-2 gap-4">
            {[comparison.a, comparison.b].map((analysis: Analysis, i: number) => (
              <div key={i} className="glass-card space-y-2">
                <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">
                  Analysis {i === 0 ? 'A' : 'B'} Stats
                </div>
                {analysis.stats && (
                  <>
                    <Row label="Positive" value={`${analysis.stats.sentimentPercentages.positive}%`} color="text-emerald-400" />
                    <Row label="Negative" value={`${analysis.stats.sentimentPercentages.negative}%`} color="text-red-400" />
                    <Row label="Neutral" value={`${analysis.stats.sentimentPercentages.neutral}%`} color="text-cyan-400" />
                    <Row label="Avg Score" value={analysis.stats.averageScore.toFixed(3)} color="text-slate-300" />
                    <Row label="Sarcastic" value={String(analysis.stats.sarcasticCount)} color="text-purple-400" />
                    <Row label="Toxic" value={String(analysis.stats.toxicCount)} color="text-amber-400" />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`font-semibold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}
