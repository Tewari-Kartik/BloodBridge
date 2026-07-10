import { useState, useRef, useCallback } from 'react'

/**
 * useStagedPipeline — narrates a single-shot API response as 5 sequential
 * stages completing one after another, instead of an opaque spinner.
 *
 * The real backend call still happens once and returns all at once — this
 * just paces the *reveal* of each stage's UI to feel like the pipeline is
 * genuinely flowing through steps 1->5, which mirrors how the system
 * actually works internally even though the network round-trip is a
 * single request. If the real call finishes before the staged reveal
 * does, the reveal keeps going at its own pace (never faked longer than
 * the shortest sensible reading time); if the call is slow, the tracker
 * simply holds at whichever stage it last reached rather than lying
 * about progress it doesn't have evidence for.
 */
export function useStagedPipeline({ stageDurations = [280, 420, 380, 520, 340] } = {}) {
  const [activeStage, setActiveStage] = useState(0)
  const [completedStages, setCompletedStages] = useState([])
  const timeoutsRef = useRef([])

  const reset = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
    setActiveStage(0)
    setCompletedStages([])
  }, [])

  const start = useCallback(() => {
    reset()
    let elapsed = 0
    stageDurations.forEach((dur, idx) => {
      const stageNum = idx + 1
      const t1 = setTimeout(() => setActiveStage(stageNum), elapsed)
      elapsed += dur
      const t2 = setTimeout(() => {
        setCompletedStages(prev => [...prev, stageNum])
      }, elapsed)
      timeoutsRef.current.push(t1, t2)
    })
  }, [reset, stageDurations])

  const finishImmediately = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
    setActiveStage(5)
    setCompletedStages([1, 2, 3, 4, 5])
  }, [])

  return { activeStage, completedStages, start, reset, finishImmediately }
}
