import type { ReactNode } from 'react'

interface LayoutWrapperProps {
  children: ReactNode
}

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  return (
    <div className="relative w-full h-full overflow-hidden crt-flicker crt-scanlines bg-black">
      {/* Vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-50"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.85) 100%)',
        }}
      />
      {children}
    </div>
  )
}
