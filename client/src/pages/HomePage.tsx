import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  Link2,
  Zap,
  ChevronDown,
  ChevronUp,
  Clock,
  TrendingUp,
  Youtube,
  ShoppingCart,
} from 'lucide-react';
import { useCreateAnalysis, useAnalyses, useDeleteAnalysis } from '../api/hooks';
import { AnalysisCard } from '../components/AnalysisCard';
import { ProgressView } from '../components/ProgressView';
import type { Analysis, Platform } from '@social-pulse/shared';

const YOUTUBE_URL_REGEX = /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be)\/.+/i;
const FLIPKART_URL_REGEX = /^(https?:\/\/)?([a-zA-Z0-9-]+\.)?flipkart\.(com|co\.in)\/.+/i;

export function HomePage() {
  const navigate = useNavigate();

  const [platform, setPlatform] = useState<Platform>('youtube');
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);
  const [options, setOptions] = useState({
    maxComments: 0, // 0 = All comments/reviews
    order: 'relevance' as 'relevance' | 'time',
    includeReplies: true,
    provider: 'gemini' as 'gemini' | 'openai' | 'local',
  });

  const createAnalysis = useCreateAnalysis();
  const { data: analysesData } = useAnalyses({ limit: '6' });
  const deleteAnalysis = useDeleteAnalysis();

  const validateUrl = (val: string, targetPlatform: Platform = platform): string => {
    const trimmed = val.trim();
    if (!trimmed) {
      return targetPlatform === 'youtube'
        ? 'Please enter a YouTube video URL'
        : 'Please enter a Flipkart product link';
    }

    if (targetPlatform === 'youtube') {
      if (!YOUTUBE_URL_REGEX.test(trimmed)) {
        return 'Please enter a valid YouTube video URL (e.g. youtube.com/watch?v=...)';
      }
    } else {
      if (!FLIPKART_URL_REGEX.test(trimmed)) {
        return 'Please enter a valid Flipkart product link (e.g. flipkart.com/.../p/itm...)';
      }
    }

    return '';
  };

  const handleUrlChange = (val: string) => {
    setUrl(val);
    if (urlError) setUrlError('');

    // Auto-detect platform from pasted link
    const trimmed = val.trim();
    if (FLIPKART_URL_REGEX.test(trimmed) && platform !== 'flipkart') {
      setPlatform('flipkart');
      toast.success('Switched to Flipkart mode', { id: 'platform-switch', duration: 1500 });
    } else if (YOUTUBE_URL_REGEX.test(trimmed) && platform !== 'youtube') {
      setPlatform('youtube');
      toast.success('Switched to YouTube mode', { id: 'platform-switch', duration: 1500 });
    }
  };

  const handlePlatformChange = (newPlatform: Platform) => {
    setPlatform(newPlatform);
    setUrlError('');
    if (url.trim()) {
      const err = validateUrl(url, newPlatform);
      if (err) setUrlError(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateUrl(url, platform);
    if (err) {
      setUrlError(err);
      return;
    }
    setUrlError('');

    try {
      const result = await createAnalysis.mutateAsync({
        platform,
        url: url.trim(),
        options,
      });
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
      <div className="text-center mb-10">
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
          {platform === 'youtube'
            ? 'Paste any YouTube URL. We fetch, clean, and analyze every comment with AI — giving you actionable insights in real time.'
            : 'Paste any Flipkart product link. We fetch, clean, and analyze customer reviews with AI — breaking down ratings, aspects, and pros & cons.'}
        </p>
      </div>

      {/* ── Platform switcher ────────────────────────────────── */}
      <div className="flex gap-2 mb-4 p-1 glass-card rounded-xl" role="tablist" aria-label="Select platform">
        <button
          type="button"
          role="tab"
          aria-selected={platform === 'youtube'}
          onClick={() => handlePlatformChange('youtube')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
            platform === 'youtube'
              ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/40 shadow-sm'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Youtube className="w-4 h-4" aria-hidden="true" />
          YouTube Comments
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={platform === 'flipkart'}
          onClick={() => handlePlatformChange('flipkart')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
            platform === 'flipkart'
              ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/40 shadow-sm'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <ShoppingCart className="w-4 h-4" aria-hidden="true" />
          Flipkart Reviews
        </button>
      </div>

      {/* ── Analyze form ─────────────────────────────────────── */}
      <form onSubmit={handleSubmit} id="analyze-form" aria-label={`Analyze ${platform === 'youtube' ? 'YouTube video' : 'Flipkart product'}`}>
        <div className="glass-card mb-4">
          <label htmlFor="content-url" className="block text-sm font-medium text-slate-300 mb-2">
            {platform === 'youtube' ? 'YouTube Video URL' : 'Flipkart Product Link'}
          </label>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
              <input
                id="content-url"
                type="url"
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder={
                  platform === 'youtube'
                    ? 'https://youtube.com/watch?v=...'
                    : 'https://www.flipkart.com/.../p/itm...'
                }
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
              aria-label={platform === 'youtube' ? 'Analyze video' : 'Analyze product'}
            >
              <Zap className="w-4 h-4" aria-hidden="true" />
              <span>
                {createAnalysis.isPending
                  ? 'Starting…'
                  : platform === 'youtube'
                  ? 'Analyze'
                  : 'Analyze Product'}
              </span>
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
                <label htmlFor="max-items" className="block text-xs text-slate-400 mb-1">
                  {platform === 'youtube' ? 'Comments to analyze' : 'Reviews to analyze'}
                </label>
                <select
                  id="max-items"
                  value={options.maxComments}
                  onChange={(e) => setOptions({ ...options, maxComments: Number(e.target.value) })}
                  className="input-base text-xs py-2"
                >
                  <option value={0}>⚡ All {platform === 'youtube' ? 'comments' : 'reviews'}</option>
                  <option value={100}>100 (quick test)</option>
                  <option value={300}>300</option>
                  <option value={500}>500</option>
                  <option value={1000}>1,000</option>
                  <option value={5000}>5,000</option>
                  <option value={10000}>10,000</option>
                </select>
              </div>
              <div>
                <label htmlFor="item-order" className="block text-xs text-slate-400 mb-1">Order</label>
                <select
                  id="item-order"
                  value={options.order}
                  onChange={(e) => setOptions({ ...options, order: e.target.value as 'relevance' | 'time' })}
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
                  onChange={(e) => setOptions({ ...options, provider: e.target.value as 'gemini' | 'openai' | 'local' })}
                  className="input-base text-xs py-2"
                >
                  <option value="gemini">Gemini</option>
                  <option value="openai">OpenAI</option>
                  <option value="local">Local (fast)</option>
                </select>
              </div>
              {platform === 'youtube' ? (
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
              ) : (
                <div className="flex flex-col justify-end">
                  <span className="text-xs text-slate-500">Aspect & rating mismatch checks enabled</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Supported formats hint */}
        <p className="text-center text-xs text-slate-600 mb-8">
          {platform === 'youtube'
            ? 'Supports: youtube.com/watch, youtu.be, /shorts, /live, /embed'
            : 'Supports: flipkart.com product pages & share links (flipkart.com/.../p/itm...)'}
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
          <p className="text-slate-500 text-sm">
            No analyses yet. Paste a YouTube or Flipkart link above to get started!
          </p>
        </div>
      )}
    </div>
  );
}
