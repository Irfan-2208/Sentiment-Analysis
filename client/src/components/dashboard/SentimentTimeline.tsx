import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { TimePoint } from '@social-pulse/shared';

export function SentimentTimeline({ data }: { data: TimePoint[] }) {
  // Transform data for recharts
  const chartData = data.map((p) => ({
    bucket: p.bucket.length > 10 ? p.bucket.slice(5) : p.bucket, // trim year if present
    positive: p.positive,
    negative: p.negative,
    neutral: p.neutral,
  }));

  return (
    <section aria-labelledby="timeline-heading">
      <h2 id="timeline-heading" className="section-title">Sentiment Over Time</h2>
      <div className="glass-card">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
            <defs>
              <linearGradient id="positive-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="negative-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="neutral-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="bucket" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
              labelStyle={{ color: '#94a3b8', marginBottom: 4 }}
              itemStyle={{ color: '#e2e8f0' }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              formatter={(value) => <span style={{ color: '#94a3b8' }}>{value}</span>}
            />
            <Area type="monotone" dataKey="positive" name="Positive" stroke="#10b981" fill="url(#positive-gradient)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="negative" name="Negative" stroke="#ef4444" fill="url(#negative-gradient)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="neutral" name="Neutral" stroke="#06b6d4" fill="url(#neutral-gradient)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
