import { useState, useEffect } from 'react'
import { motion } from 'motion/react'

/**
 * NavbarV2 — refined nav bar.
 *
 * Changes from the original:
 * - Scroll-aware: transparent at the very top of the dashboard hero,
 *   solidifies with a hairline border once the user scrolls past it.
 *   (A dark navbar sitting directly on a dark hero with no separation
 *   was part of why the site read flat — this gives the page a sense
 *   of depth/layering as you scroll.)
 * - Active tab indicator is a Motion `layoutId` underline that *slides*
 *   between tabs instead of just appearing/disappearing — small detail,
 *   reads as considerably more premium.
 * - Profile avatar ring uses the new teal accent (a person, not a
 *   red-flagged state) instead of red, freeing red for actual urgency.
 */
export default function NavbarV2({ page, setPage, user, onLogout }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const navItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'matching', label: 'Matching' },
    { id: 'map', label: 'Donor Map' },
    { id: 'forecast', label: 'Forecast' },
  ]

  return (
    <nav className={`navbar-v2 ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="container navbar-v2-inner">
        <a className="nav-brand" href="#" onClick={(e) => { e.preventDefault(); setPage('dashboard') }}>
          <img src="/logo.png" alt="BloodBridge" />
          <h1>BloodBridge</h1>
        </a>

        <ul className="nav-links-v2">
          {navItems.map((n) => (
            <li key={n.id} className="nav-links-v2-item">
              <button
                className={page === n.id ? 'active' : ''}
                onClick={() => setPage(n.id)}
              >
                {n.label}
                {page === n.id && (
                  <motion.span
                    layoutId="nav-underline"
                    className="nav-underline-v2"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
              </button>
            </li>
          ))}

          <li>
            <button
              className={`nav-profile-btn-v2 ${page === 'profile' ? 'active' : ''}`}
              onClick={() => setPage('profile')}
              title="Profile"
            >
              <span className="nav-profile-avatar-v2">{(user?.name || 'U')[0].toUpperCase()}</span>
            </button>
          </li>
          <li>
            <button className="login-logout-btn-v2" onClick={onLogout}>
              Log out
            </button>
          </li>
        </ul>
      </div>
    </nav>
  )
}
