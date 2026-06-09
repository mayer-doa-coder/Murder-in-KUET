import { Fragment } from 'react'
import type { ReactNode } from 'react'

interface LayoutWrapperProps {
  children: ReactNode
}

// ── Blood drops — fall from top ──────────────────────────────────────────────
const BLOOD_DROPS = Array.from({ length: 8 }, (_, i) => ({
  left:     `${8 + i * 12}%`,
  size:      5 + (i % 3) * 2,
  duration: `${4.5 + (i % 3) * 1.5}s`,
  delay:    `-${(i * 1.8) % 6}s`,
}))

// ── Dark rotating shards (triangles / diamonds / irregular) ──────────────────
const SHARD_SHAPES = [
  'polygon(50% 0%, 0% 100%, 100% 100%)',
  'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
  'polygon(15% 0%, 85% 8%, 100% 72%, 50% 100%, 0% 68%)',
  'polygon(0% 20%, 60% 0%, 100% 40%, 80% 100%, 20% 100%)',
]
const SHARD_COLORS = ['#1e0000', '#3a0000', '#2a0000', '#cccccc22', '#ffffff11', '#8b0000']
const SHARDS = Array.from({ length: 11 }, (_, i) => ({
  left:     `${3 + i * 9}%`,
  bottom:   `${(i * 13) % 65}%`,
  size:      9 + (i % 4) * 6,
  shape:     SHARD_SHAPES[i % SHARD_SHAPES.length],
  color:     SHARD_COLORS[i % SHARD_COLORS.length],
  duration: `${15 + (i % 5) * 3}s`,
  delay:    `-${(i * 2.4) % 18}s`,
}))

// ── Mystery symbols drifting upward ──────────────────────────────────────────
const RAW_SYMBOLS = ['?', '†', '◆', '?', '†', '∴', '◆']
const SYMBOL_COLORS = ['#8b0000', '#cc0000', '#ffffff44', '#aa0000', '#ffffff33', '#660000', '#cc0000']
const MYSTERY_SYMBOLS = RAW_SYMBOLS.map((sym, i) => ({
  sym,
  left:     `${6 + i * 13}%`,
  bottom:   `${(i * 14) % 60}%`,
  fontSize:  8 + (i % 3) * 3,
  color:     SYMBOL_COLORS[i],
  duration: `${13 + (i % 4) * 2}s`,
  delay:    `-${(i * 2.8) % 16}s`,
}))

// ── DNA helix pairs — two dots per position, counter-rotating X wave ─────────
const DNA_PAIRS = Array.from({ length: 18 }, (_, i) => ({
  left:     `${2 + i * 5.5}%`,
  bottom:   `${(i * 7) % 65}%`,
  duration: `${10 + (i % 5) * 2}s`,
  delay:    `-${(i * 1.6) % 12}s`,
}))

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  return (
    <div className="relative w-full h-full overflow-hidden crt-flicker crt-scanlines bg-black">

      {/* ── Vignette ──────────────────────────────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none z-50"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.88) 100%)',
        }}
      />

      {/* ── Atmospheric particles ──────────────────────────────────────── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">

        {/* Blood drops falling from top */}
        {BLOOD_DROPS.map((d, i) => (
          <div
            key={`bd-${i}`}
            style={{
              position: 'absolute',
              left: d.left,
              top: '-12px',
              width:  `${d.size}px`,
              height: `${Math.round(d.size * 1.5)}px`,
              background: 'radial-gradient(ellipse at 40% 32%, #cc2200 0%, #6b0000 100%)',
              borderRadius: '50% 50% 50% 50% / 38% 38% 62% 62%',
              animationName: 'blood-fall',
              animationDuration: d.duration,
              animationDelay: d.delay,
              animationTimingFunction: 'ease-in',
              animationIterationCount: 'infinite',
            }}
          />
        ))}

        {/* Dark rotating polygon shards */}
        {SHARDS.map((s, i) => (
          <div
            key={`sh-${i}`}
            style={{
              position: 'absolute',
              left: s.left,
              bottom: s.bottom,
              width:  `${s.size}px`,
              height: `${s.size}px`,
              background: s.color,
              clipPath: s.shape,
              animationName: 'shard-rise',
              animationDuration: s.duration,
              animationDelay: s.delay,
              animationTimingFunction: 'linear',
              animationIterationCount: 'infinite',
            }}
          />
        ))}

        {/* Mystery symbols */}
        {MYSTERY_SYMBOLS.map((s, i) => (
          <div
            key={`ms-${i}`}
            style={{
              position: 'absolute',
              left: s.left,
              bottom: s.bottom,
              fontSize: `${s.fontSize}px`,
              color: s.color,
              fontFamily: "'Press Start 2P', monospace",
              userSelect: 'none',
              animationName: 'symbol-rise',
              animationDuration: s.duration,
              animationDelay: s.delay,
              animationTimingFunction: 'linear',
              animationIterationCount: 'infinite',
            }}
          >
            {s.sym}
          </div>
        ))}

        {/* DNA helix — paired counter-rotating dots */}
        {DNA_PAIRS.map((p, i) => (
          <Fragment key={`dna-${i}`}>
            <div
              style={{
                position: 'absolute',
                left: p.left,
                bottom: p.bottom,
                width: 3, height: 3,
                borderRadius: '50%',
                background: '#cc2200',
                animationName: 'dna-rise-a',
                animationDuration: p.duration,
                animationDelay: p.delay,
                animationTimingFunction: 'linear',
                animationIterationCount: 'infinite',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: p.left,
                bottom: p.bottom,
                width: 3, height: 3,
                borderRadius: '50%',
                background: '#eeeeee',
                animationName: 'dna-rise-b',
                animationDuration: p.duration,
                animationDelay: p.delay,
                animationTimingFunction: 'linear',
                animationIterationCount: 'infinite',
              }}
            />
          </Fragment>
        ))}

      </div>

      {/* ── Slow red light pulse ───────────────────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background: 'radial-gradient(ellipse at 40% 35%, #6b000033 0%, transparent 65%)',
          animation: 'light-pulse 5s ease-in-out infinite',
        }}
      />

      {/* ── Glitch burst flash ────────────────────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none z-20"
        style={{
          background: 'linear-gradient(135deg, #cc000022, #00008822, #00660011)',
          animation: 'glitch-burst 9s linear infinite',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none z-20"
        style={{
          background: 'linear-gradient(45deg, #00660011, #cc004422)',
          animation: 'glitch-burst 9s linear infinite',
          animationDelay: '-4.5s',
        }}
      />

      {children}
    </div>
  )
}
