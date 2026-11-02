import type { ProductMeta } from '@social-pulse/shared';
import { ShoppingBag, Star, ExternalLink, Tag } from 'lucide-react';

export function ProductHeader({ meta }: { meta: ProductMeta }) {
  const formattedPrice =
    typeof meta.price === 'number'
      ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
          meta.price
        )
      : undefined;

  return (
    <div className="glass-card flex flex-col sm:flex-row gap-5 items-start" role="region" aria-label="Product information">
      {meta.thumbnailUrl ? (
        <img
          src={meta.thumbnailUrl}
          alt={meta.title}
          className="w-full sm:w-32 h-32 rounded-xl object-contain bg-white/5 p-2 flex-shrink-0 border border-white/10"
          loading="eager"
        />
      ) : (
        <div className="w-full sm:w-32 h-32 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
          <ShoppingBag className="w-12 h-12 text-amber-400/80" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="badge-demo text-xs bg-amber-500/20 text-amber-300 border-amber-500/30 font-medium">
            Flipkart Reviews
          </span>
          {meta.brand && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-400 bg-white/5 px-2.5 py-0.5 rounded-full border border-white/10">
              <Tag className="w-3 h-3 text-slate-400" />
              {meta.brand}
            </span>
          )}
          {meta.productId && (
            <span className="text-xs text-slate-500 font-mono">
              ID: {meta.productId}
            </span>
          )}
        </div>

        <h2 className="text-lg font-bold text-slate-100 leading-snug line-clamp-2 mb-2">
          {meta.title}
        </h2>

        <div className="flex flex-wrap items-center gap-4 text-sm mt-3">
          {formattedPrice && (
            <div className="text-xl font-bold text-emerald-400">
              {formattedPrice}
            </div>
          )}

          {typeof meta.rating === 'number' && meta.rating > 0 && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm font-semibold">
              <Star className="w-4 h-4 fill-emerald-400 text-emerald-400" />
              <span>{meta.rating.toFixed(1)}</span>
              {meta.ratingCount && (
                <span className="text-xs text-emerald-300/70 font-normal">
                  ({meta.ratingCount.toLocaleString()} ratings)
                </span>
              )}
            </div>
          )}

          {meta.reviewCount && (
            <div className="text-sm text-slate-400">
              {meta.reviewCount.toLocaleString()} customer reviews
            </div>
          )}

          {meta.productUrl && (
            <a
              href={meta.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-brand-400 hover:text-brand-300 transition-colors ml-auto text-sm"
              aria-label="Open product on Flipkart"
            >
              <ExternalLink className="w-4 h-4" />
              View on Flipkart
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

