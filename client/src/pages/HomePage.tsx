import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Link2, Zap, ChevronDown, ChevronUp, Clock, TrendingUp } from 'lucide-react';
import { useCreateAnalysis, useAnalyses, useDeleteAnalysis } from '../api/hooks';
import { AnalysisCard } from '../components/AnalysisCard';
import { ProgressView } from '../components/ProgressView';
import type { Analysis } from '@social-pulse/shared';

const YOUTUBE_URL_REGEX = /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be)\/.+/i;

export function HomePage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);
  const [options, setOptions] = useState({
    maxComments: 0, // 0 = All comments in the video
    order: 'relevance' as 'relevance' | 'time',
    includeReplies: true,
    provider: 'gemini' as 'gemini' | 'openai' | 'local',
  });

  const createAnalysis = useCreateAnalysis();
  const { data: analysesData } = useAnalyses({ limit: '6' });
  const deleteAnalysis = useDeleteAnalysis();

  const validateUrl = (val: string) => {
    if (!val.trim()) return 'Please enter a YouTube URL';
    if (!YOUTUBE_URL_REGEX.test(val.trim())) return 'Please enter a valid YouTube video URL';
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateUrl(url);
    if (err) { setUrlError(err); return; }
    setUrlError('');

    try {
      const result = await createAnalysis.mutateAsync({ url: url.trim(), options });
      setActiveAnalysisId(result.analysisId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start analysis');
    }
  };

  if (activeAnalysisId) {
    return (
      <ProgressView
        analysisId={activeAnalysisId}
        onComplete={(id) => navigate(`/analysis/${id}`)}
        onCancel={() => setActiveAnalysisId(null)}
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs text-slate-400 mb-6">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          AI-powered sentiment analysis
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-4 leading-tight">
          Understand your{' '}
          <span className="text-gradient">audience</span>
          <br />at scale
        </h1>
        <p className="text-slate-400 text-lg max-w-xl mx-auto">
          Paste any YouTube URL. We fetch, clean, and analyze every comment with AI — giving you actionable insights in real time.
        </p>
      </div>

      {/* ── Analyze form ─────────────────────────────────────── */}
      <form onSubmit={handleSubmit} id="analyze-form" aria-label="Analyze YouTube video">
        <div className="glass-card mb-4">
          <label htmlFor="youtube-url" className="block text-sm font-medium text-slate-300 mb-2">
            YouTube Video URL
          </label>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
              <input
                id="youtube-url"
                type="url"
                value={url}
                onChange={(e) => { setUrl(e.target.value); if (urlError) setUrlError(validateUrl(e.target.value)); }}
                placeholder="https://youtube.com/watch?v=..."
                className={`input-base pl-10 ${urlError ? 'border-red-500/50 focus:ring-red-500' : ''}`}
                aria-invalid={!!urlError}
                aria-describedby={urlError ? 'url-error' : undefined}
                autoComplete="url"
              />
            </div>
            <button
              type="submit"
              className="btn-primary whitespace-nowrap"
              disabled={createAnalysis.isPending}
              aria-label="Analyze video"
            >
              <Zap className="w-4 h-4" aria-hidden="true" />
              <span>{createAnalysis.isPending ? 'Starting…' : 'Analyze'}</span>
            </button>
          </div>
          {urlError && (
            <p id="url-error" className="mt-2 text-xs text-red-400" role="alert">{urlError}</p>
          )}

          {/* Options toggle */}
          <button
            type="button"
            onClick={() => setShowOptions(!showOptions)}
            className="mt-4 flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            aria-expanded={showOptions}
            aria-controls="options-panel"
          >
            {showOptions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Advanced options
          </button>

          {showOptions && (
            <div id="options-panel" className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label htmlFor="max-comments" className="block text-xs text-slate-400 mb-1">Comments to analyze</label>
                <select
                  id="max-comments"
                  value={options.maxComments}
                  onChange={(e) => setOptions({ ...options, maxComments: Number(e.target.value) })}
                  className="input-base text-xs py-2"
                >
                  <option value={0}>⚡ All comments (entire video)</option>
                  <option value={100}>100 comments (quick test)</option>
                  <option value={300}>300 comments</option>
                  <option value={500}>500 comments</option>
                  <option value={1000}>1,000 comments</option>
                  <option value={5000}>5,000 comments</option>
                  <option value={10000}>10,000 comments</option>
                  <option value={50000}>50,000 comments</option>
                </select>
              </div>
              <div>
                <label htmlFor="comment-order" className="block text-xs text-slate-400 mb-1">Order</label>
                <select
                  id="comment-order"
                  value={options.order}
                  onChange={(e) => setOptions({ ...options, order: e.target.value as 'relevance'|'time' })}
                  className="input-base text-xs py-2"
                >
                  <option value="relevance">Relevance</option>
                  <option value="time">Time</option>
                </select>
              </div>
              <div>
                <label htmlFor="ai-provider" className="block text-xs text-slate-400 mb-1">AI Provider</label>
                <select
                  id="ai-provider"
                  value={options.provider}
                  onChange={(e) => setOptions({ ...options, provider: e.target.value as 'gemini'|'openai'|'local' })}
                  className="input-base text-xs py-2"
                >
                  <option value="gemini">Gemini</option>
                  <option value="openai">OpenAI</option>
                  <option value="local">Local (fast)</option>
                </select>
              </div>
              <div className="flex flex-col justify-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.includeReplies}
                    onChange={(e) => setOptions({ ...options, includeReplies: e.target.checked })}
                    className="w-4 h-4 rounded accent-brand-500"
                    id="include-replies"
                  />
                  <span className="text-xs text-slate-400">Include replies</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Supported formats hint */}
        <p className="text-center text-xs text-slate-600 mb-8">
          Supports: youtube.com/watch, youtu.be, /shorts, /live, /embed
        </p>
      </form>

      {/* ── Recent analyses ──────────────────────────────────── */}
      {analysesData?.data && analysesData.data.length > 0 && (
        <section aria-labelledby="recent-heading">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-slate-500" aria-hidden="true" />
            <h2 id="recent-heading" className="text-sm font-medium text-slate-400">Recent analyses</h2>
            <div className="flex-1 h-px bg-white/5" />
            <Link to="/history" className="text-xs text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1">
              View all <TrendingUp className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid gap-3">
            {(analysesData.data as Analysis[]).map((analysis) => (
              <AnalysisCard
                key={analysis.id}
                analysis={analysis}
                onDelete={(id) => deleteAnalysis.mutate(id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {(!analysesData?.data || analysesData.data.length === 0) && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-8 h-8 text-slate-600" />
          </div>
          <p className="text-slate-500 text-sm">No analyses yet. Paste a YouTube URL above to get started!</p>
        </div>
      )}
    </div>
  );
}
