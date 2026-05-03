import type { ReactNode } from 'react'

interface LayoutWrapperProps {
  children: ReactNode
}

// 28 dust particles — pre-computed so they never re-randomize on re-render
const PARTICLES = Array.from({ length: 28 }, (_, i) => {
  const anims = ['dust-rise-a', 'dust-rise-b', 'dust-rise-c'] as const
  return {
    left:      `${(i * 3.67 + 2)   % 97}%`,
    bottom:    `${(i * 7.31 + 1.5) % 42}%`,
    size:       (i % 3) + 1,                           // 1–3 px
    duration: `${10 + (i * 1.37)   % 14}s`,
    delay:    `-${(i * 1.73)        % 21}s`,            // already in-progress
    anim:      anims[i % 3],
    color:     i % 5 === 0 ? '#e0e0e0' : '#999999',
  }
})

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

      {/* ── Floating dust particles ────────────────────────────────────── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
        {PARTICLES.map((p, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: p.left,
              bottom: p.bottom,
              width:  p.size,
              height: p.size,
              borderRadius: '50%',
              background: p.color,
              animationName: p.anim,
              animationDuration: p.duration,
              animationDelay: p.delay,
              animationTimingFunction: 'linear',
              animationIterationCount: 'infinite',
            }}
          />
        ))}
      </div>

      {/* ── Slow light pulse (red tint breathe) ───────────────────────── */}
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
      {/* Second offset glitch layer */}
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
