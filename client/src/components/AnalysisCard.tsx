import { Link } from 'react-router-dom';
import { ExternalLink, Trash2, CheckCircle, Loader2, XCircle, AlertCircle, Clock } from 'lucide-react';
import type { Analysis } from '@social-pulse/shared';

const STATUS_CONFIG = {
  done: { icon: CheckCircle, color: 'text-emerald-400', label: 'Done' },
  running: { icon: Loader2, color: 'text-brand-400 animate-spin', label: 'Running' },
  pending: { icon: Clock, color: 'text-yellow-400', label: 'Pending' },
  failed: { icon: XCircle, color: 'text-red-400', label: 'Failed' },
  cancelled: { icon: AlertCircle, color: 'text-slate-500', label: 'Cancelled' },
};

export function AnalysisCard({ analysis, onDelete }: { analysis: Analysis; onDelete: (id: string) => void }) {
  const sc = STATUS_CONFIG[analysis.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = sc.icon;

  return (
    <div className="glass rounded-xl p-4 flex items-center gap-4 hover:bg-white/5 transition-all group">
      {/* Thumbnail */}
      {analysis.videoMeta?.thumbnailUrl ? (
        <img
          src={analysis.videoMeta.thumbnailUrl}
          alt=""
          className="w-16 h-10 rounded-lg object-cover flex-shrink-0 bg-white/5"
          loading="lazy"
        />
      ) : (
        <div className="w-16 h-10 rounded-lg bg-white/5 flex-shrink-0" aria-hidden="true" />
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200 truncate">
          {analysis.videoMeta?.title ?? analysis.url}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <StatusIcon className={`w-3 h-3 ${sc.color}`} aria-hidden="true" />
          <span className="text-xs text-slate-500">{sc.label}</span>
          {analysis.demo && <span className="badge-demo text-[10px]">Demo</span>}
          {analysis.usedFallback && <span className="badge-fallback text-[10px]">Fallback</span>}
          {analysis.stats && (
            <>
              <span className="text-slate-700">·</span>
              <span className="text-xs text-slate-500">{analysis.stats.totalAnalyzed} comments</span>
              <span className="text-slate-700">·</span>
              <span className="text-xs text-emerald-400">{analysis.stats.sentimentPercentages.positive}% positive</span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {analysis.status === 'done' && (
          <Link
            to={`/analysis/${analysis.id}`}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/8 transition-all"
            aria-label="Open analysis"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
        )}
        <button
          onClick={() => onDelete(analysis.id)}
          className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
          aria-label="Delete analysis"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
