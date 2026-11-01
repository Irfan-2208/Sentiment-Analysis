import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X, Loader2, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { useSSE } from '../hooks/useSSE';
import { useCancelJob, useAnalysis } from '../api/hooks';

const STAGES = ['validating', 'fetching', 'preprocessing', 'analyzing', 'aggregating', 'done'] as const;

const STAGE_LABELS: Record<string, string> = {
  validating: 'Validating video',
  fetching: 'Fetching comments',
  preprocessing: 'Cleaning & deduplicating',
  analyzing: 'AI sentiment analysis',
  aggregating: 'Building insights',
  done: 'Complete',
};

interface ProgressData {
  stage: string;
  fetched: number;
  analyzed: number;
  total: number;
}

interface ProgressViewProps {
  analysisId: string;
  onComplete: (id: string) => void;
  onCancel: () => void;
}

export function ProgressView({ analysisId, onComplete, onCancel }: ProgressViewProps) {
  const [progress, setProgress] = useState<ProgressData>({ stage: 'validating', fetched: 0, analyzed: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const cancelJob = useCancelJob();
  const qc = useQueryClient();

  // Also poll in case SSE drops
  useAnalysis(analysisId, {
    refetchInterval: isDone ? false : 3000,
  });

  const handleProgress = useCallback((data: unknown) => {
    setProgress(data as ProgressData);
  }, []);

  const handleDone = useCallback(() => {
    setIsDone(true);
    qc.invalidateQueries({ queryKey: ['analysis', analysisId] });
    qc.invalidateQueries({ queryKey: ['analyses'] });
    setTimeout(() => onComplete(analysisId), 800);
  }, [analysisId, onComplete, qc]);

  const handleError = useCallback((data: unknown) => {
    const d = data as { message?: string };
    setError(d.message ?? 'Analysis failed. Please try again.');
  }, []);

  useSSE(analysisId, {
    onProgress: handleProgress,
    onDone: handleDone,
    onError: handleError,
    onCancelled: onCancel,
  });

  const currentStageIndex = STAGES.indexOf(progress.stage as typeof STAGES[number]);
  const progressPercent = progress.total > 0
    ? Math.round((progress.analyzed / progress.total) * 100)
    : currentStageIndex > 0 ? Math.round((currentStageIndex / STAGES.length) * 100) : 5;

  const handleCancel = async () => {
    try {
      await cancelJob.mutateAsync(analysisId);
      onCancel();
    } catch {
      onCancel();
    }
  };

  if (error) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-bold mb-2">Analysis Failed</h2>
        <p className="text-slate-400 text-sm mb-6">{error}</p>
        <button onClick={onCancel} className="btn-primary">Try Again</button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      <div className="glass-card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold">Analyzing…</h2>
          {!isDone && (
            <button
              onClick={handleCancel}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all"
              aria-label="Cancel analysis"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Stage stepper */}
        <div className="space-y-3 mb-6" role="list" aria-label="Analysis stages">
          {STAGES.filter(s => s !== 'done').map((stage, i) => {
            const isActive = stage === progress.stage;
            const isComplete = currentStageIndex > i || isDone;

            return (
              <div
                key={stage}
                role="listitem"
                className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${
                  isActive ? 'bg-brand-500/10 border border-brand-500/20' : 'opacity-50'
                }`}
                aria-current={isActive ? 'step' : undefined}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isComplete ? 'bg-emerald-500/20' : isActive ? 'bg-brand-500/20' : 'bg-white/5'
                }`}>
                  {isComplete ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : isActive ? (
                    <Loader2 className="w-4 h-4 text-brand-400 animate-spin" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-slate-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isActive ? 'text-slate-100' : 'text-slate-500'}`}>
                    {STAGE_LABELS[stage]}
                  </p>
                  {isActive && stage === 'analyzing' && progress.total > 0 && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {progress.analyzed} / {progress.total} comments
                    </p>
                  )}
                  {isActive && stage === 'fetching' && progress.fetched > 0 && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {progress.fetched} comments fetched
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-slate-500">
            <span>Progress</span>
            <span>{isDone ? 100 : progressPercent}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/5 overflow-hidden" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
            <div
              className={`h-full rounded-full transition-all duration-500 ${isDone ? 'bg-emerald-500' : 'bg-gradient-to-r from-brand-500 to-purple-500'}`}
              style={{ width: `${isDone ? 100 : progressPercent}%` }}
            />
          </div>
        </div>

        {isDone && (
          <div className="mt-4 flex items-center gap-2 text-emerald-400 text-sm">
            <CheckCircle className="w-4 h-4" />
            Analysis complete! Redirecting…
          </div>
        )}
      </div>
    </div>
  );
}
