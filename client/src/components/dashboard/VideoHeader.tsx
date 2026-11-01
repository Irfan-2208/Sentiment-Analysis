import type { VideoMeta } from '@social-pulse/shared';
import { Eye, ThumbsUp, MessageSquare, ExternalLink } from 'lucide-react';

function formatNum(n?: number): string {
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function VideoHeader({ meta }: { meta: VideoMeta }) {
  return (
    <div className="glass-card flex flex-col sm:flex-row gap-4 items-start" role="region" aria-label="Video information">
      {meta.thumbnailUrl && (
        <img
          src={meta.thumbnailUrl}
          alt={`Thumbnail for ${meta.title}`}
          className="w-full sm:w-36 h-auto rounded-xl object-cover flex-shrink-0"
          loading="eager"
        />
      )}
      <div className="flex-1 min-w-0">
        <h2 className="text-lg font-bold text-slate-100 leading-snug line-clamp-2 mb-1">{meta.title}</h2>
        <p className="text-sm text-slate-500 mb-3">{meta.channelTitle}</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Eye className="w-4 h-4" aria-hidden="true" />
            <span>{formatNum(meta.viewCount)} views</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <ThumbsUp className="w-4 h-4" aria-hidden="true" />
            <span>{formatNum(meta.likeCount)} likes</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <MessageSquare className="w-4 h-4" aria-hidden="true" />
            <span>{formatNum(meta.commentCount)} comments</span>
          </div>
          <a
            href={`https://youtube.com/watch?v=${meta.videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-brand-400 hover:text-brand-300 transition-colors"
            aria-label="Open video on YouTube"
          >
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
            Open on YouTube
          </a>
        </div>
      </div>
    </div>
  );
}
