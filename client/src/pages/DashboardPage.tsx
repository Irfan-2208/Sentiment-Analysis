import { useParams, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ArrowLeft, RefreshCw, Download, AlertCircle, Info } from 'lucide-react';
import { useAnalysis, useReanalyze } from '../api/hooks';
import { SentimentOverview } from '../components/dashboard/SentimentOverview';
import { SentimentTimeline } from '../components/dashboard/SentimentTimeline';
import { KeywordsCloud } from '../components/dashboard/KeywordsCloud';
import { EmotionWheel } from '../components/dashboard/EmotionWheel';
import { InsightPanel } from '../components/dashboard/InsightPanel';
import { CommentFeed } from '../components/dashboard/CommentFeed';
import { AspectBreakdown } from '../components/dashboard/AspectBreakdown';
import { VideoHeader } from '../components/dashboard/VideoHeader';

export function DashboardPage() {
  const { id } = useParams<{ id: string }>();
  const { data: analysis, isLoading, error } = useAnalysis(id!);
  const reanalyze = useReanalyze();

  const handleExport = (format: 'json' | 'csv') => {
    window.open(`/api/analyses/${id}/export?format=${format}`, '_blank');
  };

  const handleReanalyze = async () => {
    try {
      await reanalyze.mutateAsync(id!);
      toast.success('Reanalysis started');
    } catch {
      toast.error('Failed to start reanalysis');
    }
  };

  if (isLoading) return <DashboardSkeleton />;

  if (error || !analysis) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <h2 className="text-xl font-bold">Analysis not found</h2>
        <Link to="/" className="btn-secondary">← Go Home</Link>
      </div>
    );
  }

  const stats = analysis.stats;
  const insight = analysis.insight;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Topbar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <Link to="/" className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
        <div className="flex items-center gap-2">
          {analysis.demo && <span className="badge-demo">Demo mode</span>}
          {analysis.usedFallback && (
            <span className="badge-fallback" title="Some or all comments were analyzed with the local rule-based analyzer">
              <Info className="w-3 h-3" />
              Local analyzer
            </span>
          )}
          <button
            onClick={() => handleExport('csv')}
            className="btn-secondary text-xs py-2"
            aria-label="Export as CSV"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            onClick={() => handleExport('json')}
            className="btn-secondary text-xs py-2"
            aria-label="Export as JSON"
          >
            <Download className="w-3.5 h-3.5" />
            JSON
          </button>
          <button
            onClick={handleReanalyze}
            disabled={reanalyze.isPending}
            className="btn-secondary text-xs py-2"
            aria-label="Re-run analysis"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reanalyze.isPending ? 'animate-spin' : ''}`} />
            Reanalyze
          </button>
        </div>
      </div>

      {/* ── Video header ────────────────────────────────────── */}
      {analysis.videoMeta && <VideoHeader meta={analysis.videoMeta} />}

      {/* ── Fallback Engine Banner (B2 requirement) ──────────── */}
      {analysis.usedFallback && (
        <div className="w-full bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl p-4 flex items-center justify-between flex-wrap gap-4 text-sm shadow-sm">
          <div className="flex items-center gap-3">
            <Info className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="font-semibold text-amber-200">
                {analysis.stats?.totalFallback ?? 'Some'} of {analysis.stats?.totalAnalyzed ?? 'all'} comments analyzed by fallback engine
              </p>
              <p className="text-xs text-amber-300/80">
                AI quota/rate limit was encountered. Results were completed with high-accuracy local ensemble.
              </p>
            </div>
          </div>
          <button
            onClick={handleReanalyze}
            disabled={reanalyze.isPending}
            className="btn-secondary text-xs py-2 px-3.5 whitespace-nowrap bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border-amber-500/40 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 inline ${reanalyze.isPending ? 'animate-spin' : ''}`} />
            Re-analyze with AI
          </button>
        </div>
      )}

      {!stats ? (
        <div className="glass-card text-center py-12 text-slate-500">
          <AlertCircle className="w-8 h-8 mx-auto mb-3 text-red-400" />
          <p>Analysis did not complete successfully.</p>
        </div>
      ) : (
        <>
          {/* ── KPI Row ─────────────────────────────────────── */}
          <SentimentOverview stats={stats} />

          {/* ── Main grid ───────────────────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Left: timeline + keywords */}
            <div className="xl:col-span-2 space-y-6">
              {stats.sentimentOverTime.length > 1 && <SentimentTimeline data={stats.sentimentOverTime} />}
              <KeywordsCloud keywords={stats.topKeywords} />
              {stats.aspectStats.length > 0 && <AspectBreakdown aspects={stats.aspectStats} />}
            </div>

            {/* Right: emotion + insight */}
            <div className="space-y-6">
              <EmotionWheel emotions={stats.emotionDistribution} />
              {insight && <InsightPanel insight={insight} />}
            </div>
          </div>

          {/* ── Comment feed ────────────────────────────────── */}
          <CommentFeed analysisId={id!} />
        </>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="skeleton h-6 w-32" />
      <div className="skeleton h-28 rounded-2xl" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 skeleton h-64 rounded-2xl" />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    </div>
  );
}
