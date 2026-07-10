import { useRef } from 'react'

/**
 * GlowCard — wraps the login/signup card so a soft radial highlight follows
 * the cursor across its surface, like light catching glass. Pure CSS custom
 * properties updated on mousemove (no re-render), so it's cheap and buttery
 * even on lower-end devices.
 */
export default function GlowCard({ children, className = '' }) {
  const ref = useRef(null)

  function handleMouseMove(e) {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    el.style.setProperty('--glow-x', `${x}%`)
    el.style.setProperty('--glow-y', `${y}%`)
  }

  return (
    <div ref={ref} className={`glow-card ${className}`} onMouseMove={handleMouseMove}>
      {children}
    </div>
  )
}
