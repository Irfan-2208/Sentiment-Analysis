import { useState, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  Link2,
  Zap,
  ChevronDown,
  ChevronUp,
  Clock,
  TrendingUp,
  Upload,
  FileText,
  Youtube,
  ShoppingCart,
  X,
  AlertCircle,
} from 'lucide-react';
import { useCreateAnalysis, useAnalyses, useDeleteAnalysis } from '../api/hooks';
import { AnalysisCard } from '../components/AnalysisCard';
import { ProgressView } from '../components/ProgressView';
import type { Analysis } from '@social-pulse/shared';

const YOUTUBE_URL_REGEX = /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be)\/.+/i;
const FLIPKART_URL_REGEX = /flipkart\.com/i;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

type Platform = 'youtube' | 'flipkart';

export function HomePage() {
  const navigate = useNavigate();

  // ── Shared state ────────────────────────────────────────────────────────────
  const [platform, setPlatform] = useState<Platform>('youtube');
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [options, setOptions] = useState({
    maxComments: 0,
    order: 'relevance' as 'relevance' | 'time',
    includeReplies: true,
    provider: 'gemini' as 'gemini' | 'openai' | 'local',
  });

  // ── YouTube state ────────────────────────────────────────────────────────────
  const [ytUrl, setYtUrl] = useState('');
  const [ytUrlError, setYtUrlError] = useState('');

  // ── Flipkart state ───────────────────────────────────────────────────────────
  const [flipkartFile, setFlipkartFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [productName, setProductName] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [productUrlError, setProductUrlError] = useState('');
  const [fileError, setFileError] = useState('');
  const [inputError, setInputError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createAnalysis = useCreateAnalysis();
  const { data: analysesData } = useAnalyses({ limit: '6' });
  const deleteAnalysis = useDeleteAnalysis();

  // ── Validation helpers ───────────────────────────────────────────────────────
  const validateYtUrl = (val: string) => {
    if (!val.trim()) return 'Please enter a YouTube URL';
    if (!YOUTUBE_URL_REGEX.test(val.trim())) return 'Please enter a valid YouTube video URL';
    return '';
  };

  const validateFlipkartUrl = (val: string) => {
    if (!val.trim()) return '';
    if (!FLIPKART_URL_REGEX.test(val.trim())) return 'Must be a flipkart.com URL (used for display only)';
    return '';
  };

  const validateFile = (file: File): string => {
    if (file.size > MAX_FILE_SIZE) return `File too large (max 5 MB). Got ${(file.size / 1024 / 1024).toFixed(1)} MB`;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'json', 'txt'].includes(ext ?? '')) return 'Only .csv, .json, or .txt files are accepted';
    return '';
  };

  // ── File drop / pick ─────────────────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    const err = validateFile(file);
    setFileError(err);
    setFlipkartFile(err ? null : file);
    if (!err) setPastedText(''); // clear paste when file chosen
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const removeFile = () => {
    setFlipkartFile(null);
    setFileError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (platform === 'youtube') {
      const err = validateYtUrl(ytUrl);
      if (err) { setYtUrlError(err); return; }
      setYtUrlError('');
      try {
        const result = await createAnalysis.mutateAsync({
          platform: 'youtube',
          url: ytUrl.trim(),
          options,
        });
        setActiveAnalysisId(result.analysisId);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to start analysis');
      }
    } else {
      // Flipkart
      const urlErr = validateFlipkartUrl(productUrl);
      if (urlErr) { setProductUrlError(urlErr); return; }
      setProductUrlError('');

      if (!flipkartFile && !pastedText.trim()) {
        setInputError('Please upload a CSV/JSON file or paste reviews below');
        return;
      }
      setInputError('');

      try {
        const result = await createAnalysis.mutateAsync({
          platform: 'flipkart',
          url: productUrl.trim() || undefined,
          productMeta: productName.trim() ? { title: productName.trim() } : undefined,
          file: flipkartFile ?? undefined,
          pastedText: pastedText.trim() || undefined,
          options: { provider: options.provider },
        });
        setActiveAnalysisId(result.analysisId);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to start analysis');
      }
    }
  };

  // ── Progress view ────────────────────────────────────────────────────────────
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
      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
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
          Analyze YouTube comments or Flipkart product reviews with AI — get actionable insights in real time.
        </p>
      </div>

      {/* ── Platform switcher ────────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-4 p-1 glass-card rounded-xl" role="tablist" aria-label="Select platform">
        <button
          type="button"
          role="tab"
          aria-selected={platform === 'youtube'}
          onClick={() => { setPlatform('youtube'); setInputError(''); setFileError(''); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
            platform === 'youtube'
              ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/40'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Youtube className="w-4 h-4" aria-hidden="true" />
          YouTube
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={platform === 'flipkart'}
          onClick={() => { setPlatform('flipkart'); setYtUrlError(''); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
            platform === 'flipkart'
              ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/40'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <ShoppingCart className="w-4 h-4" aria-hidden="true" />
          Flipkart Reviews
        </button>
      </div>

      {/* ── Analyze form ──────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} id="analyze-form" aria-label={`Analyze ${platform === 'youtube' ? 'YouTube video' : 'Flipkart reviews'}`}>

        {/* ── YouTube tab ─────────────────────────────────────────────────── */}
        {platform === 'youtube' && (
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
                  value={ytUrl}
                  onChange={(e) => { setYtUrl(e.target.value); if (ytUrlError) setYtUrlError(validateYtUrl(e.target.value)); }}
                  placeholder="https://youtube.com/watch?v=..."
                  className={`input-base pl-10 ${ytUrlError ? 'border-red-500/50 focus:ring-red-500' : ''}`}
                  aria-invalid={!!ytUrlError}
                  aria-describedby={ytUrlError ? 'url-error' : undefined}
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
            {ytUrlError && (
              <p id="url-error" className="mt-2 text-xs text-red-400" role="alert">{ytUrlError}</p>
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
        )}

        {/* ── Flipkart tab ─────────────────────────────────────────────────── */}
        {platform === 'flipkart' && (
          <div className="glass-card mb-4 space-y-5">
            {/* Product info (optional) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="product-name" className="block text-xs font-medium text-slate-400 mb-1.5">
                  Product name <span className="text-slate-600">(optional)</span>
                </label>
                <input
                  id="product-name"
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. Samsung Galaxy S24"
                  className="input-base text-sm"
                />
              </div>
              <div>
                <label htmlFor="product-url" className="block text-xs font-medium text-slate-400 mb-1.5">
                  Flipkart URL <span className="text-slate-600">(optional, display only)</span>
                </label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden="true" />
                  <input
                    id="product-url"
                    type="url"
                    value={productUrl}
                    onChange={(e) => { setProductUrl(e.target.value); if (productUrlError) setProductUrlError(validateFlipkartUrl(e.target.value)); }}
                    placeholder="https://www.flipkart.com/..."
                    className={`input-base text-sm pl-10 ${productUrlError ? 'border-red-500/50' : ''}`}
                    aria-describedby={productUrlError ? 'product-url-error' : undefined}
                  />
                </div>
                {productUrlError && (
                  <p id="product-url-error" className="mt-1 text-xs text-red-400" role="alert">{productUrlError}</p>
                )}
              </div>
            </div>

            {/* File upload drop zone */}
            <div>
              <p className="text-xs font-medium text-slate-400 mb-2">
                Upload reviews file <span className="text-slate-600">(.csv, .json, .txt — max 5 MB, 5,000 rows)</span>
              </p>
              {flipkartFile ? (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                  <FileText className="w-5 h-5 text-blue-400 shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">{flipkartFile.name}</p>
                    <p className="text-xs text-slate-500">{(flipkartFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    type="button"
                    onClick={removeFile}
                    className="shrink-0 p-1 rounded hover:bg-white/10 text-slate-500 hover:text-slate-300 transition-colors"
                    aria-label="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  className={`relative flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed transition-colors cursor-pointer ${
                    dragOver
                      ? 'border-blue-400/60 bg-blue-500/10'
                      : 'border-white/15 hover:border-white/30 bg-white/[0.03]'
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                  aria-label="Drop a CSV, JSON, or TXT file here or click to browse"
                >
                  <Upload className="w-7 h-7 text-slate-500" aria-hidden="true" />
                  <p className="text-sm text-slate-400 text-center">
                    Drop a file here or <span className="text-blue-400 underline">browse</span>
                  </p>
                  <p className="text-xs text-slate-600">CSV · JSON · TXT</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.json,.txt"
                    onChange={onFileChange}
                    className="sr-only"
                    aria-hidden="true"
                  />
                </div>
              )}
              {fileError && (
                <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1" role="alert">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {fileError}
                </p>
              )}
            </div>

            {/* OR divider */}
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <div className="flex-1 h-px bg-white/10" />
              or paste reviews directly
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Paste area */}
            <div>
              <label htmlFor="paste-reviews" className="block text-xs font-medium text-slate-400 mb-1.5">
                Paste reviews <span className="text-slate-600">(one per line, or CSV/JSON)</span>
              </label>
              <textarea
                id="paste-reviews"
                value={pastedText}
                onChange={(e) => { setPastedText(e.target.value); if (e.target.value.trim()) { setFlipkartFile(null); setFileError(''); } setInputError(''); }}
                placeholder={"Great product, very durable!\nWorst purchase ever, broke in 2 days\nValue for money, decent quality\n..."}
                rows={5}
                className="input-base text-sm resize-y font-mono"
                aria-label="Paste reviews"
              />
            </div>

            {/* Column format hint */}
            <div className="rounded-lg bg-white/[0.04] border border-white/10 p-3">
              <p className="text-xs font-medium text-slate-400 mb-1.5">📋 Supported CSV columns (auto-detected)</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-slate-500">
                <span><span className="text-slate-300">Text:</span> review, text, comment, body</span>
                <span><span className="text-slate-300">Rating:</span> rating, stars, score</span>
                <span><span className="text-slate-300">Title:</span> title, headline, summary</span>
                <span><span className="text-slate-300">Date:</span> date, reviewDate, createdAt</span>
                <span><span className="text-slate-300">Helpful:</span> helpful, likes, upvotes</span>
                <span><span className="text-slate-300">Reviewer:</span> name, reviewer, author</span>
              </div>
            </div>

            {inputError && (
              <p className="text-xs text-red-400 flex items-center gap-1" role="alert">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {inputError}
              </p>
            )}

            {/* AI provider + submit */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label htmlFor="fk-ai-provider" className="text-xs text-slate-400 whitespace-nowrap">AI Provider:</label>
                <select
                  id="fk-ai-provider"
                  value={options.provider}
                  onChange={(e) => setOptions({ ...options, provider: e.target.value as 'gemini' | 'openai' | 'local' })}
                  className="input-base text-xs py-1.5"
                >
                  <option value="gemini">Gemini</option>
                  <option value="openai">OpenAI</option>
                  <option value="local">Local (fast)</option>
                </select>
              </div>
              <div className="flex-1" />
              <button
                type="submit"
                className="btn-primary whitespace-nowrap"
                disabled={createAnalysis.isPending}
                aria-label="Analyze reviews"
              >
                <Zap className="w-4 h-4" aria-hidden="true" />
                <span>{createAnalysis.isPending ? 'Starting…' : 'Analyze Reviews'}</span>
              </button>
            </div>

            {/* Provider notice */}
            <p className="text-xs text-slate-600 flex items-start gap-1.5">
              <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
              Review data you upload stays private and is only used for this analysis. No scraping of Flipkart is performed.
            </p>
          </div>
        )}

        {/* Supported formats hint */}
        <p className="text-center text-xs text-slate-600 mb-8">
          {platform === 'youtube'
            ? 'Supports: youtube.com/watch, youtu.be, /shorts, /live, /embed'
            : 'Upload your own exported review CSV/JSON, or paste review text directly'}
        </p>
      </form>

      {/* ── Recent analyses ───────────────────────────────────────────────────── */}
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
            No analyses yet. Paste a YouTube URL or upload Flipkart reviews above to get started!
          </p>
        </div>
      )}
    </div>
  );
}
