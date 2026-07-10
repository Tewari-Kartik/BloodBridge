/**
 * ECGPulse — the login page's signature visual.
 *
 * A continuously-drawing heartbeat line, rendered as SVG with a dash-offset
 * animation (pure CSS, no JS animation loop needed — cheap and smooth).
 * This replaces generic floating particles with something that actually
 * means something for a blood/health product: a live vital-sign trace.
 *
 * The line isn't decorative noise — it's the one moment on this page that
 * says "this system is watching something in real time," which is the
 * actual value proposition of BloodBridge.
 */
export default function ECGPulse({ className = '' }) {
  return (
    <svg
      className={`ecg-pulse ${className}`}
      viewBox="0 0 600 120"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ecgGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--red-500)" stopOpacity="0" />
          <stop offset="15%" stopColor="var(--red-500)" stopOpacity="0.9" />
          <stop offset="50%" stopColor="var(--teal-400)" stopOpacity="0.9" />
          <stop offset="85%" stopColor="var(--red-500)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--red-500)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        className="ecg-pulse-path"
        d="M0,60 L90,60 L110,60 L125,20 L140,100 L155,40 L170,60 L200,60
           L290,60 L310,60 L325,20 L340,100 L355,40 L370,60 L400,60
           L490,60 L510,60 L525,20 L540,100 L555,40 L570,60 L600,60"
        fill="none"
        stroke="url(#ecgGradient)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
