import { motion } from 'motion/react'

/**
 * PipelineTracker — a persistent, always-visible 5-stage progress indicator
 * for the pipeline demo.
 *
 * Real UX value: on a slow connection, a single spinner tells you nothing
 * about *where* the request is stuck. This shows exactly which of the 5 ML
 * stages is currently running, which have completed, and which are still
 * queued — narrating the actual architecture instead of hiding it behind
 * a loading state.
 *
 * `activeStage`: 0 = nothing started, 1-5 = that stage currently running,
 * `completedStages`: array of stage numbers (1-5) that have finished.
 */
const STAGES = [
  { num: 1, label: 'Preprocess' },
  { num: 2, label: 'Triage' },
  { num: 3, label: 'Entities' },
  { num: 4, label: 'Matching' },
  { num: 5, label: 'Forecast' },
]

export default function PipelineTracker({ activeStage = 0, completedStages = [], idle = false }) {
  return (
    <div className={`pipeline-tracker ${idle ? 'is-idle' : ''}`}>
      {STAGES.map((s, i) => {
        const isDone = completedStages.includes(s.num)
        const isActive = activeStage === s.num
        return (
          <div className="pipeline-tracker-item" key={s.num}>
            <div className="pipeline-tracker-node-wrap">
              <div className={`pipeline-tracker-node ${isDone ? 'is-done' : ''} ${isActive ? 'is-active' : ''}`}>
                {isDone ? (
                  <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                    <path d="M11.5 4L5.5 10L2.5 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <span>{s.num}</span>
                )}
                {isActive && <span className="pipeline-tracker-pulse" />}
              </div>
              {i < STAGES.length - 1 && (
                <div className="pipeline-tracker-line">
                  <motion.div
                    className="pipeline-tracker-line-fill"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: isDone ? 1 : 0 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              )}
            </div>
            <span className={`pipeline-tracker-label ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''}`}>
              {s.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
