import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { AspectStat } from '@social-pulse/shared';

export function AspectBreakdown({ aspects }: { aspects: AspectStat[] }) {
  const data = aspects.slice(0, 10).map((a) => ({
    aspect: a.aspect,
    positive: a.positive,
    negative: a.negative,
    neutral: a.neutral,
    total: a.total,
    net: a.positive - a.negative,
  }));

  return (
    <section aria-labelledby="aspects-heading">
      <h2 id="aspects-heading" className="section-title">Aspect Analysis</h2>
      <div className="glass-card">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
            <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis dataKey="aspect" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} width={80} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
              formatter={(value, name) => [value, name]}
            />
            <Bar dataKey="positive" name="Positive" fill="#10b981" radius={[0, 4, 4, 0]} />
            <Bar dataKey="negative" name="Negative" fill="#ef4444" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
