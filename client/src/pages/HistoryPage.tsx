import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAnalyses, useDeleteAnalysis } from '../api/hooks';
import { AnalysisCard } from '../components/AnalysisCard';
import { Search, TrendingUp, Trash2 } from 'lucide-react';
import type { Analysis } from '@social-pulse/shared';

const STATUS_OPTIONS = ['', 'done', 'running', 'pending', 'failed', 'cancelled'] as const;

export function HistoryPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useAnalyses({ q, status, page: String(page), limit: '12' });
  const deleteAnalysis = useDeleteAnalysis();

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Analysis History</h1>
          <p className="text-sm text-slate-500 mt-1">Browse and manage all past analyses</p>
        </div>
        <Link to="/" className="btn-primary text-xs">
          + New Analysis
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search by title…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            className="input-base pl-10 text-sm"
            aria-label="Search analyses"
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="input-base w-auto text-sm"
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s === '' ? 'All statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      ) : data?.data && data.data.length > 0 ? (
        <>
          <div className="space-y-3">
            {(data.data as Analysis[]).map((analysis) => (
              <AnalysisCard
                key={analysis.id}
                analysis={analysis}
                onDelete={(id) => deleteAnalysis.mutate(id)}
              />
            ))}
          </div>

          {/* Pagination */}
          {data.pagination && data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8" role="navigation" aria-label="Page navigation">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={!data.pagination!.hasPrev}
                className="btn-secondary text-xs py-2"
              >
                ← Previous
              </button>
              <span className="text-sm text-slate-500">
                Page {page} of {data.pagination.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!data.pagination!.hasNext}
                className="btn-secondary text-xs py-2"
              >
                Next →
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-20">
          <TrendingUp className="w-12 h-12 text-slate-700 mx-auto mb-4" />
          <p className="text-slate-500">
            {q || status ? 'No analyses match your filters.' : 'No analyses yet.'}
          </p>
          {!q && !status && (
            <Link to="/" className="btn-primary mt-4 inline-flex">Start your first analysis</Link>
          )}
        </div>
      )}
    </div>
  );
}
