'use client';

import { useId, useRef, useState } from 'react';

// Escrow balance over time — single-series area chart, mint (the money
// hue), labels in ink tokens. Sample data under a PREVIEW badge until F5
// history exists; the shape tells Recurra's real story: fund once, charges
// tick the balance down, a top-up jumps it back.
//
// Palette validated (dataviz six-checks, dark surface): contrast ≥3:1 and
// chroma pass for the lone mint series; the categorical lightness band
// doesn't apply to a single-series mark.

const POINTS = [
  { label: 'May 5', value: 60 },
  { label: 'May 12', value: 50 },
  { label: 'May 19', value: 50 },
  { label: 'May 26', value: 40 },
  { label: 'Jun 2', value: 90 },
  { label: 'Jun 9', value: 80 },
  { label: 'Jun 16', value: 70 },
  { label: 'Jun 23', value: 100 },
  { label: 'Jun 30', value: 90 },
  { label: 'Jul 7', value: 85 },
];

const W = 320;
const H = 110;
const PAD_X = 6;
const PAD_TOP = 10;
const PAD_BOTTOM = 20;

export function EscrowChart() {
  const gid = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(...POINTS.map((p) => p.value));
  const plotW = W - PAD_X * 2;
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const x = (i: number) => PAD_X + (i / (POINTS.length - 1)) * plotW;
  const y = (v: number) => PAD_TOP + plotH - (v / max) * plotH;

  const linePath = POINTS.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.value)}`).join(' ');
  const areaPath = `${linePath} L${x(POINTS.length - 1)},${PAD_TOP + plotH} L${x(0)},${PAD_TOP + plotH} Z`;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD_X) / plotW) * (POINTS.length - 1));
    setHover(Math.min(Math.max(i, 0), POINTS.length - 1));
  };

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label="Escrow balance over time, sample data"
      >
        <defs>
          <linearGradient id={`${gid}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--mint)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--mint)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* recessive grid — two hairlines */}
        {[0.5, 1].map((f) => (
          <line
            key={f}
            x1={PAD_X}
            x2={W - PAD_X}
            y1={PAD_TOP + plotH * (1 - f) + (f === 1 ? 0 : 0)}
            y2={PAD_TOP + plotH * (1 - f)}
            stroke="var(--line)"
            strokeWidth="1"
          />
        ))}
        <line x1={PAD_X} x2={W - PAD_X} y1={PAD_TOP + plotH} y2={PAD_TOP + plotH} stroke="var(--line)" strokeWidth="1" />

        <path d={areaPath} fill={`url(#${gid}-fill)`} />
        <path d={linePath} fill="none" stroke="var(--mint)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* hover crosshair + point */}
        {hover !== null && (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD_TOP}
              y2={PAD_TOP + plotH}
              stroke="var(--ink-faint)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <circle cx={x(hover)} cy={y(POINTS[hover].value)} r="4" fill="var(--mint)" stroke="var(--canvas)" strokeWidth="2" />
          </g>
        )}

        {/* sparse x labels — first, middle, last */}
        {[0, Math.floor((POINTS.length - 1) / 2), POINTS.length - 1].map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 4}
            textAnchor={i === 0 ? 'start' : i === POINTS.length - 1 ? 'end' : 'middle'}
            fill="var(--ink-faint)"
            fontSize="8.5"
            fontFamily="var(--font-app-mono), monospace"
          >
            {POINTS[i].label}
          </text>
        ))}
      </svg>

      {/* tooltip */}
      {hover !== null && (
        <div
          className="numeric pointer-events-none absolute rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[10px] text-ink"
          style={{
            left: `${(x(hover) / W) * 100}%`,
            top: 0,
            transform: `translateX(${hover > POINTS.length / 2 ? '-110%' : '10%'})`,
          }}
        >
          {POINTS[hover].value}.00 USDC
          <span className="text-ink-faint"> · {POINTS[hover].label}</span>
        </div>
      )}
    </div>
  );
}
