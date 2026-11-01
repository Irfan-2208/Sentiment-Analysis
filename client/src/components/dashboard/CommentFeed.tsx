import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { ThumbsUp, AlertTriangle, Zap, Globe, ChevronDown, ChevronUp, Edit3 } from 'lucide-react';
import { useComments, useOverrideComment } from '../../api/hooks';
import type { Comment } from '@social-pulse/shared';

const SENTIMENT_BADGE: Record<string, string> = {
  positive: 'badge-positive',
  negative: 'badge-negative',
  neutral: 'badge-neutral',
};

interface FiltersState {
  sentiment: string;
  language: string;
  sarcastic: boolean;
  toxic: boolean;
  sort: string;
  q: string;
}

export function CommentFeed({ analysisId }: { analysisId: string }) {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<FiltersState>({
    sentiment: '',
    language: '',
    sarcastic: false,
    toxic: false,
    sort: '-likeCount',
    q: '',
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useComments(analysisId, {
    page,
    limit: 20,
    ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v !== false)),
  });

  const override = useOverrideComment();

  const handleFilter = (key: keyof FiltersState, val: string | boolean) => {
    setFilters((f) => ({ ...f, [key]: val }));
    setPage(1);
  };

  const handleOverride = async (comment: Comment, sentiment: 'positive' | 'negative' | 'neutral') => {
    try {
      await override.mutateAsync({ analysisId, commentId: comment.id, sentiment });
      toast.success('Sentiment overridden');
    } catch {
      toast.error('Failed to override sentiment');
    }
  };

  return (
    <section aria-labelledby="comments-heading">
      <h2 id="comments-heading" className="section-title">Comments</h2>

      {/* ── Filter bar ─────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* Sentiment filter */}
        <select
          value={filters.sentiment}
          onChange={(e) => handleFilter('sentiment', e.target.value)}
          className="input-base w-auto text-xs py-1.5"
          aria-label="Filter by sentiment"
        >
          <option value="">All sentiment</option>
          <option value="positive">Positive</option>
          <option value="negative">Negative</option>
          <option value="neutral">Neutral</option>
        </select>

        {/* Language filter */}
        <select
          value={filters.language}
          onChange={(e) => handleFilter('language', e.target.value)}
          className="input-base w-auto text-xs py-1.5"
          aria-label="Filter by language"
        >
          <option value="">All languages</option>
          <option value="en">English</option>
          <option value="hinglish">Hinglish</option>
          <option value="hi">Hindi</option>
          <option value="other">Other</option>
        </select>

        {/* Sort */}
        <select
          value={filters.sort}
          onChange={(e) => handleFilter('sort', e.target.value)}
          className="input-base w-auto text-xs py-1.5"
          aria-label="Sort comments"
        >
          <option value="-likeCount">Most liked</option>
          <option value="likeCount">Least liked</option>
          <option value="-score">Highest score</option>
          <option value="score">Lowest score</option>
          <option value="-publishedAt">Newest</option>
          <option value="publishedAt">Oldest</option>
        </select>

        {/* Flags */}
        <button
          onClick={() => handleFilter('sarcastic', !filters.sarcastic)}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${filters.sarcastic ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'glass text-slate-400'}`}
          aria-pressed={filters.sarcastic}
        >
          🎭 Sarcastic
        </button>
        <button
          onClick={() => handleFilter('toxic', !filters.toxic)}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${filters.toxic ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'glass text-slate-400'}`}
          aria-pressed={filters.toxic}
        >
          ⚠️ Toxic
        </button>

        {/* Search */}
        <input
          type="search"
          value={filters.q}
          onChange={(e) => handleFilter('q', e.target.value)}
          placeholder="Search comments…"
          className="input-base flex-1 min-w-32 text-xs py-1.5"
          aria-label="Search comments"
        />
      </div>

      {/* ── Comment list ───────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-2" role="list" aria-label="Comment list">
          {data?.data?.map((comment: Comment) => {
            const a = comment.analysis;
            const isExpanded = expandedId === comment.id;
            const effectiveSentiment = comment.userOverride?.sentiment ?? a?.sentiment;

            return (
              <div
                key={comment.id}
                role="listitem"
                className="glass rounded-xl p-4 hover:bg-white/5 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Text */}
                    <p className={`text-sm text-slate-300 leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                      {comment.text}
                    </p>
                    {comment.text.length > 140 && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : comment.id)}
                        className="text-xs text-brand-400 hover:text-brand-300 mt-1 flex items-center gap-1"
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {isExpanded ? 'Show less' : 'Read more'}
                      </button>
                    )}

                    {/* Meta row */}
                    {a && (
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {/* Sentiment badge */}
                        <span className={SENTIMENT_BADGE[effectiveSentiment ?? 'neutral']}>
                          {effectiveSentiment}
                        </span>

                        {/* Score */}
                        <span
                          className={`text-xs font-mono ${a.score > 0 ? 'text-emerald-400' : a.score < 0 ? 'text-red-400' : 'text-slate-500'}`}
                        >
                          {a.score >= 0 ? '+' : ''}{a.score.toFixed(2)}
                        </span>

                        {/* Confidence */}
                        <span className="text-xs text-slate-600" title="Confidence">
                          {Math.round(a.confidence * 100)}%
                        </span>

                        {/* Language */}
                        {a.language && a.language !== 'en' && (
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <Globe className="w-3 h-3" aria-hidden="true" />
                            {a.language}
                          </span>
                        )}

                        {/* Flags */}
                        {comment.source && (
                          <span
                            className={`badge ${
                              comment.source === 'llm'
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                : comment.source === 'ensemble'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : comment.source === 'override'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                            }`}
                            title={`Analyzed by ${comment.source}`}
                          >
                            {comment.source === 'llm' ? '🤖 AI' : comment.source === 'ensemble' ? '⚡ Ensemble' : comment.source === 'fallback' ? '⚠️ Fallback' : '✏️ User'}
                          </span>
                        )}
                        {comment.needsReview && (
                          <span className="badge bg-amber-500/15 text-amber-400 border-amber-500/20" title="Low confidence, sarcasm or signal disagreement">
                            Needs Review
                          </span>
                        )}
                        {comment.duplicateCount > 0 && (
                          <span className="badge bg-slate-500/15 text-slate-400 border-slate-500/20" title={`${comment.duplicateCount} duplicate comments merged`}>
                            +{comment.duplicateCount} dupes
                          </span>
                        )}
                        {a.isSarcastic && (
                          <span className="badge bg-purple-500/15 text-purple-400 border-purple-500/20" title="Sarcastic">
                            🎭 Sarcastic
                          </span>
                        )}
                        {a.isToxic && (
                          <span className="badge bg-red-500/20 text-red-400 border-red-500/30" title="Toxic content detected">
                            <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                            Toxic
                          </span>
                        )}
                        {a.isMixed && (
                          <span className="badge bg-purple-500/15 text-purple-400 border-purple-500/20" title="Mixed sentiment">
                            ↔ Mixed
                          </span>
                        )}

                        {/* User override indicator */}
                        {comment.userOverride && (
                          <span className="badge bg-amber-500/15 text-amber-400 border-amber-500/20" title="Manually overridden">
                            <Edit3 className="w-2.5 h-2.5" />
                            Overridden
                          </span>
                        )}
                      </div>
                    )}

                    {/* Reasoning note if provided */}
                    {comment.reasoning && (
                      <p className="mt-1.5 text-xs text-slate-400 italic">
                        💡 {comment.reasoning}
                      </p>
                    )}
                  </div>

                  {/* Like count */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <div className="flex items-center gap-1 text-xs text-slate-600">
                      <ThumbsUp className="w-3 h-3" aria-hidden="true" />
                      <span>{comment.likeCount}</span>
                    </div>

                    {/* Override dropdown */}
                    {a && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <select
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) {
                              handleOverride(comment, e.target.value as 'positive' | 'negative' | 'neutral');
                              e.target.value = '';
                            }
                          }}
                          className="text-xs py-0.5 px-1 rounded-lg bg-white/5 border border-white/10 text-slate-400 cursor-pointer"
                          aria-label="Override sentiment for this comment"
                        >
                          <option value="" disabled>Override…</option>
                          <option value="positive">→ Positive</option>
                          <option value="negative">→ Negative</option>
                          <option value="neutral">→ Neutral</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {data?.data?.length === 0 && (
            <div className="text-center py-12 text-slate-500 text-sm">
              No comments match the current filters.
            </div>
          )}
        </div>
      )}

      {/* ── Pagination ─────────────────────────────────────── */}
      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6" role="navigation" aria-label="Comment pagination">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={!data.pagination.hasPrev}
            className="btn-secondary text-xs py-2"
            aria-label="Previous page"
          >
            ← Previous
          </button>
          <span className="text-sm text-slate-500">
            Page {page} of {data.pagination.totalPages}
            <span className="ml-2 text-slate-600">({data.pagination.total} total)</span>
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!data.pagination.hasNext}
            className="btn-secondary text-xs py-2"
            aria-label="Next page"
          >
            Next →
          </button>
        </div>
      )}
    </section>
  );
}
