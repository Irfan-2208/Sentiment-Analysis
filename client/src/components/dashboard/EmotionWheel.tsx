import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';
import type { EmotionStat } from '@social-pulse/shared';

const EMOTION_COLORS: Record<string, string> = {
  joy: '#f59e0b',
  anger: '#ef4444',
  sadness: '#6366f1',
  fear: '#8b5cf6',
  surprise: '#ec4899',
  disgust: '#84cc16',
  trust: '#10b981',
  anticipation: '#06b6d4',
  none: '#475569',
};

const EMOTION_EMOJIS: Record<string, string> = {
  joy: '😄', anger: '😡', sadness: '😢', fear: '😨',
  surprise: '😮', disgust: '🤢', trust: '🤝', anticipation: '⏳', none: '😶',
};

export function EmotionWheel({ emotions }: { emotions: EmotionStat[] }) {
  const filtered = emotions.filter((e) => e.emotion !== 'none' && e.count > 0);
  if (!filtered.length) return null;

  const radarData = filtered.map((e) => ({
    emotion: `${EMOTION_EMOJIS[e.emotion] ?? ''} ${e.emotion}`,
    count: e.count,
    fill: EMOTION_COLORS[e.emotion] ?? '#64748b',
  }));

  return (
    <section aria-labelledby="emotions-heading">
      <h2 id="emotions-heading" className="section-title">Emotion Distribution</h2>
      <div className="glass-card">
        <ResponsiveContainer width="100%" height={220}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="rgba(255,255,255,0.08)" />
            <PolarAngleAxis dataKey="emotion" tick={{ fill: '#64748b', fontSize: 10 }} />
            <Radar
              name="Count"
              dataKey="count"
              stroke="#5c7cfa"
              fill="#5c7cfa"
              fillOpacity={0.25}
              strokeWidth={2}
            />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
              labelStyle={{ color: '#e2e8f0', fontWeight: 600 }}
            />
          </RadarChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="grid grid-cols-3 gap-2 mt-2">
          {filtered.map((e) => (
            <div key={e.emotion} className="flex items-center gap-1.5 text-xs text-slate-500">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: EMOTION_COLORS[e.emotion] ?? '#64748b' }}
                aria-hidden="true"
              />
              <span className="truncate capitalize">{e.emotion}</span>
              <span className="text-slate-700 ml-auto">{e.count}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
