'use client';

/**
 * Section (9) — Spot Prices. Three small sparkline charts for gold/silver/copper.
 * Shared between player-facing RavenBroadsheet and the DM editor (display only;
 * no editor controls for prices in v1).
 *
 * Data is hardcoded deterministic series for v1. Replace with live market data
 * when the economy model exists.
 */

const SERIES = [
  { label: 'Gold',   unit: 'gp/oz', series: [52, 54, 53, 55, 58, 57, 60, 62, 61, 63, 65, 64], stroke: '#b08a1a' },
  { label: 'Silver', unit: 'sp/oz', series: [8, 9, 8, 10, 11, 10, 12, 11, 13, 12, 11, 12],     stroke: '#6a6a78' },
  { label: 'Copper', unit: 'cp/oz', series: [2, 3, 3, 2, 4, 3, 4, 5, 4, 4, 5, 6],              stroke: '#8a4a1a' },
] as const;

/** Additional style to merge onto the outer aside (e.g., `marginTop: auto` to pin-bottom). */
interface Props {
  style?: React.CSSProperties;
}

export default function SpotPrices({ style }: Props) {
  return (
    <aside
      style={{
        border: '1px solid #2b1f14',
        padding: '10px 12px',
        background: 'rgba(139,90,30,0.05)',
        ...style,
      }}
    >
      <div
        style={{
          fontFamily: 'EB Garamond, serif',
          fontSize: '0.72rem',
          textTransform: 'uppercase',
          letterSpacing: '0.22em',
          fontWeight: 700,
          color: '#2b1f14',
          textAlign: 'center',
          borderBottom: '1px solid #2b1f14',
          paddingBottom: 5,
          marginBottom: 8,
        }}
      >
        Spot Prices
      </div>
      {SERIES.map(({ label, unit, series, stroke }) => {
        const min = Math.min(...series);
        const max = Math.max(...series);
        const range = max - min || 1;
        const W = 100;
        const H = 24;
        const pts = series
          .map((v, i) => {
            const x = (i / (series.length - 1)) * W;
            const y = H - ((v - min) / range) * H;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(' ');
        const last = series[series.length - 1];
        const prev = series[series.length - 2];
        const delta = ((last - prev) / prev) * 100;
        const deltaStr = `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(1)}%`;
        const deltaColor = delta >= 0 ? '#2d6a3f' : '#8b1a1a';
        return (
          <div
            key={label}
            style={{
              display: 'grid',
              gridTemplateColumns: '48px 1fr auto',
              alignItems: 'center',
              gap: 6,
              padding: '4px 0',
              fontSize: '0.72rem',
              borderBottom: '1px dotted rgba(43,31,20,0.3)',
            }}
          >
            <div style={{ fontFamily: 'EB Garamond, serif', fontWeight: 700, color: '#2b1f14' }}>
              {label}
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block' }}>
              <polyline
                points={pts}
                fill="none"
                stroke={stroke}
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div style={{ textAlign: 'right', color: '#2b1f14', whiteSpace: 'nowrap' }}>
              <span style={{ fontWeight: 700 }}>{last}</span>{' '}
              <span style={{ fontSize: '0.6rem', color: '#4a3723' }}>{unit}</span>{' '}
              <span style={{ color: deltaColor, fontSize: '0.65rem' }}>{deltaStr}</span>
            </div>
          </div>
        );
      })}
    </aside>
  );
}
