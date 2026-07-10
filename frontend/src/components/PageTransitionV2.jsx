import { AnimatePresence, motion } from 'motion/react'

/**
 * Route-level transition: a restrained fade + slight scale + vertical
 * settle, on a "premium" cubic-bezier (no bounce, no overshoot — this is
 * a medical product, not a game). Replaces the GSAP-only PageTransition.
 *
 * Usage: <PageTransitionV2 pageKey={page}>{pages[page]}</PageTransitionV2>
 */
const EASE = [0.22, 1, 0.36, 1]

export default function PageTransitionV2({ children, pageKey }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pageKey}
        initial={{ opacity: 0, y: 14, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.99 }}
        transition={{ duration: 0.55, ease: EASE }}
        style={{ willChange: 'opacity, transform' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
