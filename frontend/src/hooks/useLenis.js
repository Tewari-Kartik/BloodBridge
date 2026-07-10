import { useEffect, useRef } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * Wires Lenis smooth-scroll into GSAP's ticker so ScrollTrigger stays in
 * sync with the smoothed scroll position instead of the raw scroll event.
 * Returns a ref (0..1) tracking overall page scroll progress, useful for
 * driving ambient effects like HeroSignature's scatter->network blend.
 */
export function useLenis() {
  const progressRef = useRef(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    lenis.on('scroll', ({ scroll, limit }) => {
      progressRef.current = limit > 0 ? Math.min(1, scroll / Math.min(limit, 1200)) : 0
      ScrollTrigger.update()
    })

    function raf(time) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }
    requestAnimationFrame(raf)

    gsap.ticker.add((time) => {
      lenis.raf(time * 1000)
    })
    gsap.ticker.lagSmoothing(0)

    return () => {
      lenis.destroy()
    }
  }, [])

  return progressRef
}
