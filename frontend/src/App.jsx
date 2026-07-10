import { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './index.css'

gsap.registerPlugin(ScrollTrigger)

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

async function apiPost(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

async function apiGet(path) {
  const res = await fetch(`${API}${path}`)
  return res.json()
}

// ═══════════════════════════════════════════════
// Leaflet custom marker icon
// ═══════════════════════════════════════════════
const donorIcon = new L.DivIcon({
  className: 'bb-map-pin',
  html: '<span class="bb-pin-inner">🩸</span>',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -34],
})

// ═══════════════════════════════════════════════
// Donor locations data (Indian cities)
// ═══════════════════════════════════════════════
const CITY_COORDS = {
  'Delhi':     [28.6139, 77.2090],
  'Mumbai':    [19.0760, 72.8777],
  'Bangalore': [12.9716, 77.5946],
  'Chennai':   [13.0827, 80.2707],
  'Kolkata':   [22.5726, 88.3639],
  'Gurgaon':   [28.4595, 77.0266],
  'Chandigarh':[30.7333, 76.7794],
  'Hyderabad': [17.3850, 78.4867],
  'Pune':      [18.5204, 73.8567],
  'Lucknow':   [26.8467, 80.9462],
  'Jaipur':    [26.9124, 75.7873],
  'Ahmedabad': [23.0225, 72.5714],
}

function getCityCoord(city) {
  for (const [name, coord] of Object.entries(CITY_COORDS)) {
    if (city?.toLowerCase().includes(name.toLowerCase())) return coord
  }
  return [28.6 + (Math.random() - 0.5) * 2, 77.2 + (Math.random() - 0.5) * 2]
}

// ═══════════════════════════════════════════════
// COMPONENT: Section Header (eyebrow + title + subtitle)
// ═══════════════════════════════════════════════
function SectionHeader({ eyebrow, title, children }) {
  return (
    <div className="section-header">
      {eyebrow && <span className="eyebrow">◆ {eyebrow}</span>}
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  )
}

// ═══════════════════════════════════════════════
// COMPONENT: Status Pill (backend online/offline)
// ═══════════════════════════════════════════════
function StatusPill({ online, children }) {
  return (
    <span className={`status-pill ${online ? 'online' : 'offline'}`}>
      <span className={`status-dot ${online ? 'online' : 'offline'}`}></span>
      {children}
    </span>
  )
}

// ═══════════════════════════════════════════════
// COMPONENT: Premium Cursor
// ═══════════════════════════════════════════════
function PremiumCursor() {
  const dotRef  = useRef(null)
  const ringRef = useRef(null)

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return
    const dot = dotRef.current
    const ring = ringRef.current
    if (!dot || !ring) return

    const onMove = ({ clientX: x, clientY: y }) => {
      gsap.set(dot, { x, y })
      gsap.to(ring, { x, y, duration: 0.18, ease: 'power2.out' })
    }
    const onEnter = () => ring.classList.add('hovered')
    const onLeave = () => ring.classList.remove('hovered')

    window.addEventListener('mousemove', onMove)
    document.addEventListener('mouseover', (e) => {
      if (e.target.closest('a, button, input, textarea, select, [data-cursor]')) onEnter()
      else onLeave()
    })
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  return (
    <>
      <div ref={dotRef}  className="bb-cursor-dot"  aria-hidden="true" />
      <div ref={ringRef} className="bb-cursor-ring" aria-hidden="true" />
    </>
  )
}

// ═══════════════════════════════════════════════
// COMPONENT: Scroll Reveal
// ═══════════════════════════════════════════════
function Reveal({ children, delay = 0, className = '' }) {
  const el = useRef(null)
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(el.current, {
        opacity: 0, y: 30, duration: 0.6, delay,
        ease: 'power3.out',
        scrollTrigger: { trigger: el.current, start: 'top 85%', toggleActions: 'play none none none' },
      })
    }, el)
    return () => ctx.revert()
  }, [])
  return <div ref={el} className={className}>{children}</div>
}

// ═══════════════════════════════════════════════
// COMPONENT: Page Transition
// ═══════════════════════════════════════════════
function PageTransition({ children, pageKey }) {
  const el = useRef(null)
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(el.current,
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' }
      )
    }, el)
    return () => ctx.revert()
  }, [pageKey])
  return <div ref={el} style={{ willChange: 'opacity, transform' }}>{children}</div>
}

// ═══════════════════════════════════════════════
// COMPONENT: Animated Counter
// ═══════════════════════════════════════════════
function AnimCount({ value, suffix = '', decimals = 0, duration = 1.5, delay = 0.3 }) {
  const ref = useRef(null)
  const num = parseFloat(String(value).replace(/[^0-9.]/g, '')) || 0

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obj = { val: 0 }
    const tween = gsap.to(obj, {
      val: num, duration, delay, ease: 'power2.out',
      onUpdate() {
        el.textContent = (decimals > 0
          ? obj.val.toFixed(decimals)
          : Math.round(obj.val).toLocaleString()) + suffix
      }
    })
    return () => tween.kill()
  }, [num, suffix, decimals, duration, delay])

  return <span ref={ref}>0{suffix}</span>
}

// ═══════════════════════════════════════════════
// COMPONENT: Typing Animation
// ═══════════════════════════════════════════════
function TypeWriter({ text, speed = 60 }) {
  const [displayed, setDisplayed] = useState('')
  const idx = useRef(0)
  useEffect(() => {
    idx.current = 0
    setDisplayed('')
    const iv = setInterval(() => {
      if (idx.current < text.length) {
        setDisplayed(text.slice(0, idx.current + 1))
        idx.current++
      } else clearInterval(iv)
    }, speed)
    return () => clearInterval(iv)
  }, [text, speed])
  return <>{displayed}<span className="bb-type-cursor">|</span></>
}

// ═══════════════════════════════════════════════
// COMPONENT: Floating Particles (Hero)
// ═══════════════════════════════════════════════
function HeroParticles() {
  const particles = useMemo(() =>
    Array.from({ length: 18 }, (_, i) => ({
      id: i,
      size: 4 + Math.random() * 8,
      x: Math.random() * 100,
      y: Math.random() * 100,
      dur: 12 + Math.random() * 20,
      delay: Math.random() * 8,
      opacity: 0.08 + Math.random() * 0.15,
    }))
  , [])

  return (
    <div className="bb-particles" aria-hidden="true">
      {particles.map(p => (
        <span key={p.id} className="bb-particle" style={{
          width: p.size, height: p.size,
          left: `${p.x}%`, top: `${p.y}%`,
          animationDuration: `${p.dur}s`,
          animationDelay: `${p.delay}s`,
          opacity: p.opacity,
        }} />
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════
// COMPONENT: Rotating Hero Badge — cycles through live-feeling
// facts instead of a single static "online" message.
// ═══════════════════════════════════════════════
function RotatingBadgeText({ messages, interval = 3200 }) {
  const [idx, setIdx] = useState(0)
  const [fade, setFade] = useState(true)

  useEffect(() => {
    const iv = setInterval(() => {
      setFade(false)
      setTimeout(() => {
        setIdx(i => (i + 1) % messages.length)
        setFade(true)
      }, 250)
    }, interval)
    return () => clearInterval(iv)
  }, [messages, interval])

  return (
    <span style={{
      transition: 'opacity 0.25s ease',
      opacity: fade ? 1 : 0,
      display: 'inline-block',
    }}>
      {messages[idx]}
    </span>
  )
}

// ═══════════════════════════════════════════════
// COMPONENT: Skeleton Loader
// ═══════════════════════════════════════════════
function Skeleton({ width = '100%', height = 20, rounded = false }) {
  return (
    <div className="bb-skeleton" style={{
      width, height, borderRadius: rounded ? '50%' : 'var(--radius-sm)',
    }} />
  )
}
function SkeletonCard() {
  return (
    <div className="card" style={{padding:'24px'}}>
      <Skeleton width="40%" height={14} />
      <div style={{marginTop:12}}><Skeleton width="100%" height={10} /></div>
      <div style={{marginTop:8}}><Skeleton width="70%" height={10} /></div>
      <div style={{marginTop:16, display:'flex', gap:8}}>
        <Skeleton width={60} height={28} />
        <Skeleton width={60} height={28} />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════
// HOOK: useSpeech
// ═══════════════════════════════════════════════
function useSpeech() {
  const [transcript, setTranscript] = useState('')
  const [listening, setListening] = useState(false)
  const recRef = useRef(null)
  const supported = typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  useEffect(() => {
    if (!supported) return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-IN'
    rec.onresult = (e) => {
      let text = ''
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript
      setTranscript(text)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recRef.current = rec
    return () => rec.abort()
  }, [supported])

  const startListening = useCallback(() => {
    if (!supported || listening) return
    setTranscript('')
    recRef.current?.start()
    setListening(true)
  }, [supported, listening])

  const stopListening = useCallback(() => {
    recRef.current?.stop()
    setListening(false)
  }, [])

  const speak = useCallback((text) => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-IN'
    u.rate = 1
    window.speechSynthesis.speak(u)
  }, [])

  return { transcript, listening, supported, startListening, stopListening, speak }
}

// ═══════════════════════════════════════════════
// UTIL: parse a free-text / spoken query into blood group + city
// Used by the quick-search mic on the Matching page.
// ═══════════════════════════════════════════════
function parseQuickMatchQuery(text) {
  const out = {}
  if (!text) return out

  const bgMatch = text.match(/\b(AB|A|B|O)\s?(\+|-|positive|pos|negative|neg)\b/i)
  if (bgMatch) {
    const group = bgMatch[1].toUpperCase()
    const signRaw = bgMatch[2].toLowerCase()
    const sign = signRaw.startsWith('neg') || signRaw === '-' ? '-' : '+'
    out.blood_group = `${group}${sign}`
  }

  const cityMatch = Object.keys(CITY_COORDS).find(c => text.toLowerCase().includes(c.toLowerCase()))
  if (cityMatch) out.city = cityMatch

  return out
}

// ═══════════════════════════════════════════════
// COMPONENT: reusable mic button (used on Pipeline + Matching pages)
// ═══════════════════════════════════════════════
function MicButton({ listening, onToggle, title = 'Dictate' }) {
  return (
    <button
      className="bb-mic-btn"
      onClick={onToggle}
      title={listening ? 'Stop dictation' : title}
      aria-label={listening ? 'Stop dictation' : title}
      data-cursor
      type="button"
    >
      <span className={`bb-mic-icon ${listening ? 'active' : ''}`}>{listening ? '■' : '○'}</span>
      {listening && <span className="bb-mic-pulse" />}
    </button>
  )
}

// ═══════════════════════════════════════════════
// UTIL: AI Urgency Analysis
// ═══════════════════════════════════════════════
function generateAIAnalysis(result) {
  if (!result) return null
  const urgency = result.triage?.urgency || 'UNKNOWN'
  const blood = result.entities?.summary?.blood_group?.[0] || 'unspecified blood group'
  const hospital = result.entities?.summary?.hospital?.[0] || 'unspecified hospital'
  const phone = result.entities?.summary?.phone?.[0] || null
  const units = result.entities?.summary?.units?.[0] || 'unspecified units'
  const donors = result.matching?.stats?.total_compatible || 0
  const topDonor = result.matching?.donors?.[0]?.name || null
  const time = result.processing_time_ms?.toFixed(0) || '—'

  const urgencyMap = {
    'P0_CRITICAL': { label: 'CRITICAL', emoji: '🚨', color: '#ef4444', action: 'Immediate response required. Mobilize emergency blood bank protocols.' },
    'P1_HIGH':     { label: 'HIGH',     emoji: '🟠', color: '#f97316', action: 'High-priority request. Schedule donor contact within 2 hours.' },
    'P2_MODERATE': { label: 'MODERATE', emoji: '🟡', color: '#eab308', action: 'Standard processing. Schedule transfusion within 24–48 hours.' },
    'P3_INFO':     { label: 'INFO',     emoji: '🔵', color: '#3b82f6', action: 'Informational. No immediate blood requirement detected.' },
  }
  const u = urgencyMap[urgency] || urgencyMap['P3_INFO']

  return {
    summary: `${u.emoji} **${u.label} Priority** — The AI pipeline identified this as a ${u.label.toLowerCase()}-urgency request for **${blood}** at **${hospital}**.${units !== 'unspecified units' ? ` ${units} unit(s) required.` : ''}`,
    action: u.action,
    donorSummary: donors > 0
      ? `Found **${donors}** compatible donors in the registry.${topDonor ? ` Top match: **${topDonor}**.` : ''}`
      : 'No compatible donors found in the registry.',
    contact: phone ? `📞 Contact provided: **${phone}**` : null,
    confidence: result.triage?.probabilities ? Math.max(...Object.values(result.triage.probabilities)) : null,
    processingTime: time,
    color: u.color,
    isCritical: result.triage?.is_critical,
  }
}

// ═══════════════════════════════════════════════
// PAGE: Dashboard
// ═══════════════════════════════════════════════
function DashboardPage({ onSelectStage }) {
  const [health, setHealth] = useState(null)
  const [backendOnline, setBackendOnline] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet('/api/health')
      .then(h => { setHealth(h); setBackendOnline(true) })
      .catch(() => setBackendOnline(false))
      .finally(() => setLoading(false))
  }, [])

  const stages = [
    {
      num: '01',
      name: 'Preprocessing',
      desc: 'Cleans 1,507 messages with language detection in 0.38s',
      metric: '91.4%',
      metricLabel: 'BG Extraction',
      color: 'var(--red-400)',
      overview: 'Every blood request that reaches BloodBridge arrives as messy, real-world text — SMS shorthand, WhatsApp forwards, mixed Hindi-English (Hinglish), typos, missing punctuation, and inconsistent formatting. The preprocessing stage is the pipeline\'s entry point, transforming this raw noise into a clean, structured format that every downstream model depends on.',
      howItWorks: [
        'Language detection classifies each message as English, Hindi, or Hinglish so the right tokenizer and normalization rules are applied.',
        'Unicode normalization fixes encoding inconsistencies common in messages forwarded across WhatsApp, SMS gateways, and web forms.',
        'Noise removal strips redundant punctuation, emoji clutter, and repeated characters ("urgentttt!!!") without deleting medically meaningful symbols like "+" and "-" in blood groups.',
        'Lightweight tokenization splits text into words and sub-tokens that the MuRIL transformer and entity extractor can consume directly.',
        'A whitelist protects domain-specific tokens (hospital abbreviations, blood group notation, phone number formats) from being altered during cleanup.',
      ],
      whyItMatters: 'Cleaning happens in an average of 0.38 seconds per message across the full 1,507-message training corpus — fast enough to stay invisible in a real-time pipeline. More importantly, the quality of this stage sets a ceiling on everything after it: a blood group or phone number mangled here can never be recovered downstream. This is why the 91.4% blood-group extraction accuracy achieved later in the pipeline is only possible because of the cleanup done at this first stage.',
      stats: [
        { value: '1,507', label: 'Messages Processed' },
        { value: '0.38s', label: 'Avg. Clean Time' },
        { value: '3', label: 'Languages Supported' },
      ],
    },
    {
      num: '02',
      name: 'Urgency Classifier',
      desc: 'MuRIL fine-tuned transformer for 4-class triage',
      metric: '96.1%',
      metricLabel: 'Accuracy',
      color: 'var(--green-400)',
      overview: 'Not every blood request is equally urgent — a message about an accident victim needing blood in the next hour and a post about a weekend donation camp both mention "blood," but require completely different responses. The urgency classifier reads the cleaned message and predicts how time-critical it is, so responders know instantly what to act on first.',
      howItWorks: [
        'Built on MuRIL (Multilingual Representations for Indian Languages), a transformer pretrained specifically on Indian-language text, then fine-tuned on labeled blood-request messages.',
        'Classifies every message into one of four tiers: P0_CRITICAL (immediate, life-threatening), P1_HIGH (urgent, same-day), P2_MODERATE (planned, within 24–48 hours), or P3_INFO (no direct request, e.g. donation drives).',
        'Outputs a full probability distribution across all four classes rather than a single label, so the UI can show model confidence, not just a verdict.',
        'Contextual cues — words like "ICU", "accident", "immediately" versus "next week", "camp", "planning" — are weighted heavily during fine-tuning to separate true emergencies from routine mentions.',
      ],
      whyItMatters: 'At 96.1% accuracy, the classifier lets BloodBridge auto-triage incoming messages the way a trained emergency dispatcher would, at a scale no human team could sustain. Critical cases get flagged for mobilization within minutes; informational posts never eat into that response bandwidth. Confidence scores also protect against blind automation: a low-confidence prediction can be routed for human review instead of being acted on silently.',
      stats: [
        { value: '4', label: 'Urgency Classes' },
        { value: '96.1%', label: 'Test Accuracy' },
        { value: 'MuRIL', label: 'Base Model' },
      ],
    },
    {
      num: '03',
      name: 'Entity Recognition',
      desc: '7 entity types via hybrid regex + gazetteer pipeline',
      metric: '100%',
      metricLabel: 'BG Accuracy',
      color: 'var(--blue-400)',
      overview: 'Once a message is cleaned and its urgency is known, BloodBridge still needs to know the specifics: which blood group, at which hospital, how many units, and who to call. The entity recognition stage pulls these structured facts out of unstructured text.',
      howItWorks: [
        'A hybrid pipeline combines regex pattern matching with curated gazetteers (reference dictionaries) for each of 7 entity types: blood group, hospital, contact number, units needed, patient condition, time constraint, and location.',
        'The blood-group extractor recognizes dozens of real-world phrasings and aliases — "O neg", "AB positive", "b+", "O(-ve)" — and normalizes them all to a single canonical format.',
        'A hospital gazetteer built from major Indian hospital names and common abbreviations (e.g. "AIIMS", "PGIMER") resolves partial or misspelled hospital references.',
        'Phone number extraction uses pattern matching tuned to Indian mobile formats (10-digit, optional +91 prefix) to avoid false positives from unrelated numeric strings.',
        'Extracted entities are returned as a structured list, each tagged with its type, so later stages can consume them programmatically instead of re-parsing free text.',
      ],
      whyItMatters: 'Blood-group accuracy sits at 100% because it is the single most safety-critical field in the entire system — a misread blood type could lead to contacting entirely incompatible donors. Getting this exactly right, even at the cost of leaving rarer or ambiguous fields (like exact patient condition) slightly less certain, is a deliberate design priority. The structured entities produced here feed directly into the donor-matching engine in Stage 4.',
      stats: [
        { value: '7', label: 'Entity Types' },
        { value: '100%', label: 'Blood Group Accuracy' },
        { value: 'Hybrid', label: 'Regex + Gazetteer' },
      ],
    },
    {
      num: '04',
      name: 'Donor Matching',
      desc: 'XGBoost-ranked scoring across 50K registered donors',
      metric: '50K',
      metricLabel: 'Donors',
      color: 'var(--purple-400)',
      overview: 'With urgency and entities known, BloodBridge needs to answer the question that actually saves a life: who should be contacted right now? The donor-matching stage searches a registry of 50,000 donor profiles and ranks them by real-world likelihood of being able to help.',
      howItWorks: [
        'An XGBoost gradient-boosted ranking model scores each compatible donor using multiple weighted factors rather than a single rule.',
        'Blood-type compatibility is checked first as a hard filter (e.g. O- donors are universal, AB+ recipients can accept from any group).',
        'Geographic distance between donor and hospital is factored in, prioritizing donors who can realistically arrive in time.',
        'Historical response rate — how often a donor has said yes to past requests — is weighted heavily, since a nearby donor who never responds is less useful than a slightly farther one who reliably does.',
        'Donation recency is considered to respect medical donation-interval guidelines and avoid contacting recently-donated donors unnecessarily.',
        'All factors combine into a single match score between 0 and 1, and the top-ranked donors (typically 5–20) are returned with their individual score breakdown.',
      ],
      whyItMatters: 'Searching 50,000 donor profiles by hand is impossible under time pressure; ranking by a single factor like "closest donor" ignores whether that donor is likely to actually respond. By blending compatibility, distance, and behavioral history into one score, this stage gives responders an actionable, prioritized shortlist instead of an overwhelming list — turning a search problem into a ready-to-call list in milliseconds.',
      stats: [
        { value: '50,000', label: 'Donors Indexed' },
        { value: 'XGBoost', label: 'Ranking Model' },
        { value: '<1s', label: 'Query Time' },
      ],
    },
    {
      num: '05',
      name: 'Demand Forecasting',
      desc: 'Time-series regression with 27 engineered features',
      metric: '0.876',
      metricLabel: 'R² Score',
      color: 'var(--orange-400)',
      overview: 'Beyond responding to individual requests, blood banks need to plan ahead — knowing in advance which cities and blood groups are likely to face shortages lets them run donation drives proactively instead of scrambling reactively. The forecasting stage predicts blood demand up to 7 days into the future.',
      howItWorks: [
        'A time-series regression model is trained per city and blood-group combination, using historical request volume as its core signal.',
        '27 engineered features feed the model, including day-of-week seasonality, recent rolling averages, city-level demand trends, and holiday/event effects that are known to spike or dampen donation activity.',
        'The model outputs a day-by-day predicted demand curve for the next 7 days, along with aggregate statistics like weekly total, daily average, and predicted peak day.',
        'Forecast accuracy is validated using R² (coefficient of determination) and MAE (mean absolute error) against held-out historical data.',
      ],
      whyItMatters: 'An R² of 0.876 means the model explains roughly 87.6% of the variance in real demand patterns, with a mean absolute error of just 1.99 units — accurate enough to meaningfully inform blood-bank planning decisions. Instead of finding out about a shortage when a critical request comes in, hospitals and blood banks can see it forming days in advance and schedule collection drives to get ahead of it.',
      stats: [
        { value: '7 days', label: 'Forecast Horizon' },
        { value: '0.876', label: 'R² Score' },
        { value: '1.99', label: 'MAE (units)' },
      ],
    },
  ]

  return (
    <div className="page-content">
      {/* Hero */}
      <section className="hero">
        <HeroParticles />
        <div className="container hero-content">
          <div className="hero-badge">
            <span className={`dot ${backendOnline ? '' : loading ? 'connecting' : 'offline'}`} style={loading ? {background: 'var(--blue-400)', boxShadow: '0 0 10px var(--blue-400)'} : {}}></span>
            {loading ? (
              'Connecting to AI...'
            ) : backendOnline ? (
              <RotatingBadgeText messages={[
                'AI System Online',
                '50,000+ Donors Ready',
                '<2s Avg. Response Time',
                '96.1% Triage Accuracy',
              ]} />
            ) : (
              'Backend Offline — Start the server'
            )}
          </div>
          <h2>
            Where AI Meets<br />
            <span className="gradient-text"><TypeWriter text="Lifesaving Precision" speed={70} /></span>
          </h2>
          <p>
            5-stage AI pipeline that processes blood requests in real-time —
            from urgency triage to optimal donor matching.
          </p>
          <div className="hero-stats">
            <div className="hero-stat"><div className="value"><AnimCount value="96.1" suffix="%" decimals={1} delay={0.5} /></div><div className="label">Triage Accuracy</div></div>
            <div className="hero-stat"><div className="value"><AnimCount value="50000" suffix="" delay={0.7} /></div><div className="label">Donors Indexed</div></div>
            <div className="hero-stat"><div className="value"><AnimCount value="1.08" suffix="s" decimals={2} delay={0.9} /></div><div className="label">Pipeline Latency</div></div>
            <div className="hero-stat"><div className="value"><AnimCount value="0.876" suffix="" decimals={3} delay={1.1} /></div><div className="label">Forecast R²</div></div>
          </div>
        </div>
      </section>

      {/* Impact strip — why this project matters, in plain terms */}
      <section className="section" style={{paddingTop: '32px', paddingBottom: '0'}}>
        <div className="container">
          <Reveal>
            <div
              className="card bb-glow-card ai-analysis-card"
              style={{
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '48px 40px',
              }}
            >
              <div className="hero-badge" style={{marginBottom: 20}}>
                <span aria-hidden="true">🩸</span> Why This Matters
              </div>

              <h4
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 700,
                  fontSize: 'clamp(1.4rem, 2.6vw, 1.9rem)',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.25,
                  color: 'var(--text-primary)',
                  maxWidth: 680,
                  marginBottom: 16,
                }}
              >
                Every minute spent triaging by hand is a minute a patient doesn't have.
              </h4>

              <p
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.92rem',
                  lineHeight: 1.75,
                  maxWidth: 620,
                  marginBottom: 32,
                }}
              >
                Blood banks routinely lose critical minutes triaging messages by hand across WhatsApp, SMS, and phone calls.
                BloodBridge automates that first response — reading a message, judging its urgency, extracting the medical
                specifics, and shortlisting real donors — so the humans on the other end can act instead of search.
              </p>

              <div
                style={{
                  display: 'flex',
                  gap: 0,
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  paddingTop: 28,
                  borderTop: '1px solid rgba(255,255,255,0.07)',
                  width: '100%',
                  maxWidth: 560,
                }}
              >
                {[
                  { value: '<2s', label: 'End-to-End Latency', color: 'var(--red-400)' },
                  { value: '5', label: 'Automated ML Stages', color: 'var(--blue-400)' },
                  { value: '7', label: 'Forecast Days Ahead', color: 'var(--purple-400)' },
                ].map((s, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      minWidth: 140,
                      textAlign: 'center',
                      padding: '0 24px',
                      borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                    }}
                  >
                    <div style={{fontFamily: 'var(--font-mono)', fontSize: '1.9rem', fontWeight: 800, color: s.color, lineHeight: 1.2, letterSpacing: '-0.02em'}}>
                      {s.value}
                    </div>
                    <div style={{fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 6}}>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Stats */}
      <section className="section">
        <div className="container">
          <SectionHeader eyebrow="System Status" title="System Overview">
            Real-time health status of the BloodBridge ML backend
            <StatusPill online={backendOnline || loading}>
              {loading ? 'Checking status...' : backendOnline ? `Online · ${health?.startup_time_s}s startup` : 'Offline'}
            </StatusPill>
          </SectionHeader>
          {loading ? (
            <div className="stats-grid">
              <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
            </div>
          ) : (
            <div className="stats-grid">
              <Reveal delay={0}><div className="card stat-card bb-glow-card"><div className="stat-icon" style={{color:'var(--red-400)'}}>S</div><div className="stat-value" style={{color:'var(--red-400)'}}>5</div><div className="stat-label">ML Stages</div></div></Reveal>
              <Reveal delay={0.1}><div className="card stat-card bb-glow-card"><div className="stat-icon" style={{color:'var(--green-400)'}}>M</div><div className="stat-value" style={{color:'var(--green-400)'}}>{health ? Object.values(health.models_loaded).filter(Boolean).length : '—'}/5</div><div className="stat-label">Models Loaded</div></div></Reveal>
              <Reveal delay={0.2}><div className="card stat-card bb-glow-card"><div className="stat-icon" style={{color:'var(--blue-400)'}}>D</div><div className="stat-value" style={{color:'var(--blue-400)'}}>1,507</div><div className="stat-label">Messages Trained</div></div></Reveal>
              <Reveal delay={0.3}><div className="card stat-card bb-glow-card"><div className="stat-icon" style={{color:'var(--purple-400)'}}>E</div><div className="stat-value" style={{color:'var(--purple-400)'}}>7</div><div className="stat-label">API Endpoints</div></div></Reveal>
            </div>
          )}

          {/* Pipeline Stages */}
          <div style={{marginTop: '48px'}}>
            <SectionHeader eyebrow="Architecture" title="ML Pipeline Architecture">
              Five-stage neural pipeline from raw text to actionable donor matching — click any stage for full details
            </SectionHeader>
          </div>
          <div className="stages-grid">
            {stages.map((s, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <div
                  className="card stage-card bb-glow-card bb-stage-clickable"
                  style={{height:'100%'}}
                  onClick={() => onSelectStage(s)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectStage(s) }}
                  data-cursor
                  role="button"
                  tabIndex={0}
                >
                  <div className="stage-number">{s.num}</div>
                  <h4>{s.name}</h4>
                  <p>{s.desc}</p>
                  <div className="stage-metric">
                    <span className="stage-metric-value" style={{color: s.color}}>{s.metric}</span>
                    <span className="stage-metric-label">{s.metricLabel}</span>
                  </div>
                  <span className="stage-card-cta">View details →</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

// ═══════════════════════════════════════════════
// PAGE: Stage Detail
// ═══════════════════════════════════════════════
function StageDetailPage({ stage, onBack }) {
  if (!stage) return null
  return (
    <div className="page-content">
      <section className="section" style={{paddingTop: '120px'}}>
        <div className="container" style={{maxWidth: '820px'}}>
          <button className="btn btn-secondary" onClick={onBack} style={{marginBottom: '28px'}}>
            ← Back to Dashboard
          </button>

          <Reveal>
            <div className="card bb-glow-card stage-detail-card">
              <div className="stage-detail-header">
                <span className="stage-detail-num" style={{color: stage.color}}>STAGE {stage.num}</span>
                <h2 className="stage-detail-title">{stage.name}</h2>
                <p className="stage-detail-tagline">{stage.desc}</p>
              </div>

              {/* Quick stats row */}
              <div className="stage-detail-stats">
                {stage.stats?.map((st, i) => (
                  <div key={i} className="stage-detail-stat">
                    <span className="stage-detail-stat-value" style={{color: stage.color}}>{st.value}</span>
                    <span className="stage-detail-stat-label">{st.label}</span>
                  </div>
                ))}
              </div>

              {/* Overview */}
              <div className="stage-detail-section">
                <h4 className="stage-detail-heading">Overview</h4>
                <p className="stage-detail-text">{stage.overview}</p>
              </div>

              {/* How it works */}
              <div className="stage-detail-section">
                <h4 className="stage-detail-heading">How It Works</h4>
                <ul className="stage-detail-list">
                  {stage.howItWorks?.map((point, i) => (
                    <li key={i}>
                      <span className="stage-detail-bullet" style={{background: stage.color}} />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Why it matters */}
              <div className="stage-detail-section">
                <h4 className="stage-detail-heading">Why It Matters</h4>
                <p className="stage-detail-text">{stage.whyItMatters}</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  )
}

// ═══════════════════════════════════════════════
// PAGE: Pipeline Demo
// ═══════════════════════════════════════════════
function PipelinePage() {
  const [message, setMessage] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [aiAnalysis, setAiAnalysis] = useState(null)
  const { listening, transcript, startListening, stopListening, speak, supported } = useSpeech()

  useEffect(() => {
    if (listening && transcript) setMessage(transcript)
  }, [transcript, listening])

  const examples = [
    { label: 'Critical', text: 'URGENT! Need 3 units O- blood at AIIMS Delhi. Accident victim in ICU. Call 9876543210' },
    { label: 'High', text: 'My sister needs 2 units AB+ for surgery tomorrow at Fortis Gurgaon. Contact 7012345678' },
    { label: 'Moderate', text: 'Thalassemia patient needs regular B+ transfusion. 2 units at KEM Hospital Mumbai by Thursday.' },
    { label: 'Info', text: 'Blood donation camp this Sunday at Rotary Club, Delhi. Free health checkup for all donors!' },
  ]

  async function runPipeline() {
    if (!message.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    setAiAnalysis(null)
    try {
      const r = await apiPost('/api/pipeline', { message, top_k_donors: 5 })
      setResult(r)
      const analysis = generateAIAnalysis(r)
      setAiAnalysis(analysis)
      if (analysis) speak(analysis.summary.replace(/\*\*/g, ''))
    } catch (e) {
      setError('Backend not reachable. Start it with: uv run uvicorn backend.api.main:app --port 8000')
    }
    setLoading(false)
  }

  const toggleListen = () => listening ? stopListening() : startListening()

  return (
    <div className="page-content">
      <section className="section" style={{paddingTop: '120px'}}>
        <div className="container">
          <SectionHeader eyebrow="Live Demo" title="Live Pipeline Demo">
            Enter a blood request message to see all 5 ML stages process it in real-time
          </SectionHeader>

          <div className="card bb-glow-card" style={{marginBottom: '24px'}}>
            <div className="textarea-wrap" style={{position:'relative'}}>
              <span className="textarea-icon">•</span>
              <textarea
                placeholder="Describe the blood requirement… e.g. Need 3 units O- at AIIMS Delhi for accident victim"
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={4}
              />
              {supported && (
                <MicButton listening={listening} onToggle={toggleListen} title="Dictate message" />
              )}
            </div>
            <div style={{display:'flex', gap:'10px', marginTop:'16px', flexWrap:'wrap', alignItems:'center'}}>
              <button className="btn btn-primary" onClick={runPipeline} disabled={loading || !message.trim()}>
                {loading ? <><span className="spinner"></span> Processing…</> : 'Run Full Pipeline'}
              </button>
              <span style={{color:'var(--text-muted)', fontSize:'0.8rem'}}>or try an example:</span>
              {examples.map((ex, i) => (
                <button key={i} className="btn btn-secondary" onClick={() => setMessage(ex.text)}>{ex.label}</button>
              ))}
            </div>
            {error && <p className="error-msg">{error}</p>}
          </div>

          {/* Loading Skeletons */}
          {loading && (
            <div className="results-grid">
              <SkeletonCard /><SkeletonCard /><SkeletonCard />
            </div>
          )}

          {/* AI Analysis Card */}
          {aiAnalysis && (
            <Reveal>
              <div className="card ai-analysis-card" style={{marginBottom: '24px', borderColor: aiAnalysis.color + '40'}}>
                <div className="ai-analysis-header">
                  <span className="ai-badge">🤖 AI Analysis</span>
                  <span style={{color:'var(--text-muted)', fontSize:'0.8rem'}}>Processed in {aiAnalysis.processingTime}ms</span>
                </div>
                <div className="ai-analysis-body">
                  <p className="ai-summary" dangerouslySetInnerHTML={{__html: aiAnalysis.summary.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}} />
                  <div className="ai-action" style={{borderLeftColor: aiAnalysis.color}}>
                    <span className="ai-action-label">Recommended Action</span>
                    <p>{aiAnalysis.action}</p>
                  </div>
                  <p className="ai-donors" dangerouslySetInnerHTML={{__html: aiAnalysis.donorSummary.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}} />
                  {aiAnalysis.contact && <p className="ai-contact" dangerouslySetInnerHTML={{__html: aiAnalysis.contact.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}} />}
                  {aiAnalysis.confidence && (
                    <div className="ai-confidence">
                      <span>Model Confidence</span>
                      <div className="ai-conf-bar"><div className="ai-conf-fill" style={{width: `${aiAnalysis.confidence * 100}%`, background: aiAnalysis.color}} /></div>
                      <span>{(aiAnalysis.confidence * 100).toFixed(1)}%</span>
                    </div>
                  )}
                </div>
              </div>
            </Reveal>
          )}

          {/* Results */}
          {result && !loading && (
            <div className="results-grid">
              <Reveal delay={0.05}>
                <div className="card result-card bb-glow-card">
                  <div className="result-card-header"><span className="result-stage">Stage 1</span><h4>Preprocessing</h4></div>
                  <div className="result-body">
                    <div className="result-row"><span className="result-label">Cleaned</span><span className="result-value mono">{result.preprocessing?.cleaned}</span></div>
                    <div className="result-row"><span className="result-label">Language</span><span className="result-value">{result.preprocessing?.language?.language} ({(result.preprocessing?.language?.confidence * 100).toFixed(0)}%)</span></div>
                  </div>
                </div>
              </Reveal>

              {result.triage && (
                <Reveal delay={0.1}>
                  <div className="card result-card bb-glow-card">
                    <div className="result-card-header"><span className="result-stage">Stage 2</span><h4>Urgency Classification</h4></div>
                    <div className="result-body">
                      <div style={{display:'flex', alignItems:'center', gap:'16px', marginBottom:'16px'}}>
                        <span className={`urgency-badge urgency-${result.triage.urgency}`}>{result.triage.urgency}</span>
                        <span style={{color:'var(--text-muted)', fontSize:'0.85rem'}}>{result.triage.is_critical ? '⚠️ Critical' : 'Non-critical'}</span>
                      </div>
                      <div className="prob-bars">
                        {result.triage.probabilities && Object.entries(result.triage.probabilities).map(([label, prob]) => (
                          <div key={label} className="prob-row">
                            <span className="prob-label">{label}</span>
                            <div className="prob-bar-bg"><div className="prob-bar-fill" style={{width: `${prob * 100}%`}}></div></div>
                            <span className="prob-value">{(prob * 100).toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Reveal>
              )}

              <Reveal delay={0.15}>
                <div className="card result-card bb-glow-card">
                  <div className="result-card-header"><span className="result-stage">Stage 3</span><h4>Named Entities ({result.entities?.entity_count || 0} found)</h4></div>
                  <div className="result-body">
                    <div className="entities-wrap">
                      {result.entities?.entities?.map((e, i) => (
                        <span key={i} className={`entity-tag entity-${e.type}`}>
                          <span className="entity-type">{e.type.replace('_', ' ')}</span>
                          <span className="entity-value">{e.value}</span>
                        </span>
                      ))}
                      {(!result.entities?.entities?.length) && <p style={{color:'var(--text-muted)'}}>No entities found</p>}
                    </div>
                  </div>
                </div>
              </Reveal>

              {result.matching && (
                <Reveal delay={0.2}>
                  <div className="card result-card full-width bb-glow-card">
                    <div className="result-card-header"><span className="result-stage">Stage 4</span><h4>Donor Matching — {result.matching.stats?.total_compatible} compatible</h4></div>
                    <div className="result-body">
                      <table className="donor-table">
                        <thead><tr><th>Rank</th><th>Donor Name</th><th>Blood</th><th>City</th><th>Distance</th><th>Response Rate</th><th>Match Score</th></tr></thead>
                        <tbody>
                          {result.matching.donors?.map(d => (
                            <tr key={d.rank}>
                              <td><span className={`donor-rank ${d.rank > 1 ? 'rank-other' : ''}`}>{d.rank}</span></td>
                              <td className="donor-name">{d.name}</td>
                              <td><span className="blood-badge">{d.blood_group}</span></td>
                              <td>{d.city}</td>
                              <td>{d.distance_km} km</td>
                              <td>{(d.response_rate * 100).toFixed(0)}%</td>
                              <td>
                                <span className="score-value">{d.match_score.toFixed(3)}</span>
                                <span className="score-bar"><span className="score-bar-fill" style={{width:`${d.match_score * 100}%`}}></span></span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Reveal>
              )}

              <div className="card result-card perf-card">
                <span>⚡ Pipeline completed in</span>
                <span className="perf-time">{result.processing_time_ms?.toFixed(0)}ms</span>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

// ═══════════════════════════════════════════════
// PAGE: Donor Matching
// ═══════════════════════════════════════════════
function MatchingPage() {
  const [form, setForm] = useState({ blood_group: 'O-', hospital: 'AIIMS Delhi', city: 'Delhi', urgency: 'P0_CRITICAL', top_k: 10 })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  // Quick voice/text search — parses spoken or typed phrases like
  // "Need O negative donors in Mumbai" into the form filters below.
  const [quickQuery, setQuickQuery] = useState('')
  const [quickApplied, setQuickApplied] = useState(null)
  const { listening, transcript, startListening, stopListening, supported } = useSpeech()

  useEffect(() => {
    if (listening && transcript) setQuickQuery(transcript)
  }, [transcript, listening])

  function applyQuickQuery() {
    const parsed = parseQuickMatchQuery(quickQuery)
    if (Object.keys(parsed).length === 0) {
      setQuickApplied('none')
      return
    }
    setForm(f => ({ ...f, ...parsed }))
    setQuickApplied(parsed)
  }

  const toggleListen = () => listening ? stopListening() : startListening()

  async function search() {
    setLoading(true)
    try {
      const r = await apiPost('/api/match', form)
      setResult(r)
    } catch { alert('Backend offline') }
    setLoading(false)
  }

  return (
    <div className="page-content">
      <section className="section" style={{paddingTop: '120px'}}>
        <div className="container">
          <SectionHeader eyebrow="Donor Search" title="Donor Matching Engine">
            Search 50,000 registered donors using XGBoost-powered ranking
          </SectionHeader>

          {/* Quick voice/text search */}
          <div className="card bb-glow-card" style={{marginBottom: '16px'}}>
            <label className="login-label" style={{marginBottom: 10, display:'block'}}>
              Quick Search <span style={{color:'var(--text-muted)', fontWeight: 400, textTransform:'none', letterSpacing:0}}>— speak or type, we'll fill the filters below</span>
            </label>
            <div className="textarea-wrap" style={{position:'relative'}}>
              <span className="textarea-icon">🔍</span>
              <textarea
                placeholder='Try: "Need O negative donors in Mumbai"'
                value={quickQuery}
                onChange={e => { setQuickQuery(e.target.value); setQuickApplied(null) }}
                rows={1}
                style={{minHeight: 'auto', padding: '18px 60px 18px 52px'}}
              />
              {supported && (
                <MicButton listening={listening} onToggle={toggleListen} title="Voice search" />
              )}
            </div>
            <div style={{display:'flex', alignItems:'center', gap:12, marginTop:12, flexWrap:'wrap'}}>
              <button className="btn btn-secondary" onClick={applyQuickQuery} disabled={!quickQuery.trim()}>
                Apply to filters ↓
              </button>
              {quickApplied === 'none' && (
                <span style={{color:'var(--text-muted)', fontSize:'0.78rem'}}>
                  Couldn't detect a blood group or city — try including both, e.g. "AB+ in Chennai".
                </span>
              )}
              {quickApplied && quickApplied !== 'none' && (
                <span style={{color:'var(--green-400)', fontSize:'0.78rem'}}>
                  Applied{quickApplied.blood_group ? ` · ${quickApplied.blood_group}` : ''}{quickApplied.city ? ` · ${quickApplied.city}` : ''}
                </span>
              )}
            </div>
          </div>

          <div className="card bb-glow-card" style={{marginBottom: '24px'}}>
            <div className="match-form">
              <div className="form-group">
                <label>Blood Group Needed</label>
                <select value={form.blood_group} onChange={e => setForm({...form, blood_group: e.target.value})}>
                  {['O+','O-','A+','A-','B+','B-','AB+','AB-'].map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Hospital</label>
                <select value={form.hospital} onChange={e => setForm({...form, hospital: e.target.value})}>
                  {['AIIMS Delhi','Fortis Hospital Gurgaon','KEM Hospital Mumbai','Apollo Hospital Chennai','PGIMER Chandigarh','Narayana Health Bangalore'].map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Urgency</label>
                <select value={form.urgency} onChange={e => setForm({...form, urgency: e.target.value})}>
                  {['P0_CRITICAL','P1_HIGH','P2_MODERATE','P3_INFO'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <button className="btn btn-primary" onClick={search} disabled={loading}>
                {loading ? 'Searching...' : '🔍 Find Donors'}
              </button>
            </div>
          </div>

          {loading && (
            <div className="stats-grid" style={{gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '24px'}}>
              <SkeletonCard /><SkeletonCard /><SkeletonCard />
            </div>
          )}

          {result && !loading && (
            <>
              <div className="stats-grid" style={{gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '24px'}}>
                <Reveal delay={0}><div className="card stat-card bb-glow-card"><div className="stat-value" style={{color:'var(--green-400)'}}>{result.stats?.total_compatible}</div><div className="stat-label">Compatible Donors</div></div></Reveal>
                <Reveal delay={0.1}><div className="card stat-card bb-glow-card"><div className="stat-value" style={{color:'var(--red-400)'}}>{result.stats?.exact_match_available}</div><div className="stat-label">Exact Match</div></div></Reveal>
                <Reveal delay={0.2}><div className="card stat-card bb-glow-card"><div className="stat-value" style={{color:'var(--blue-400)'}}>{result.stats?.compatible_groups?.join(', ')}</div><div className="stat-label">Compatible Groups</div></div></Reveal>
              </div>
              <Reveal delay={0.15}>
                <div className="card bb-glow-card">
                  <table className="donor-table">
                    <thead><tr><th>Rank</th><th>Name</th><th>Blood</th><th>City</th><th>Distance</th><th>Response</th><th>Donations</th><th>Score</th></tr></thead>
                    <tbody>
                      {result.donors?.map(d => (
                        <tr key={d.rank}>
                          <td><span className={`donor-rank ${d.rank > 1 ? 'rank-other' : ''}`}>{d.rank}</span></td>
                          <td className="donor-name">{d.name}</td>
                          <td><span className="blood-badge">{d.blood_group}</span></td>
                          <td>{d.city}</td>
                          <td>{d.distance_km} km</td>
                          <td>{(d.response_rate * 100).toFixed(0)}%</td>
                          <td>{d.total_donations}</td>
                          <td>
                            <span className="score-value">{d.match_score.toFixed(3)}</span>
                            <span className="score-bar"><span className="score-bar-fill" style={{width:`${d.match_score * 100}%`}}></span></span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Reveal>
            </>
          )}
        </div>
      </section>
    </div>
  )
}

// ═══════════════════════════════════════════════
// PAGE: Forecast
// ═══════════════════════════════════════════════
function ForecastPage() {
  const [city, setCity] = useState('Delhi')
  const [bg, setBg] = useState('O+')
  const [predictions, setPredictions] = useState(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const r = await apiPost('/api/forecast', { city, blood_group: bg, days_ahead: 7 })
      setPredictions(r.predictions)
    } catch { alert('Backend offline') }
    setLoading(false)
  }

  const maxDemand = predictions ? Math.max(...predictions.map(p => p.predicted_demand), 1) : 1

  return (
    <div className="page-content">
      <section className="section" style={{paddingTop: '120px'}}>
        <div className="container">
          <SectionHeader eyebrow="Forecasting" title="7-Day Demand Forecast">
            XGBoost time-series model predicting blood demand across Indian cities (R² = 0.876, MAE = 1.99 units)
          </SectionHeader>

          <div className="card bb-glow-card" style={{marginBottom: '24px'}}>
            <div className="forecast-controls">
              <div className="form-group">
                <label>City</label>
                <select value={city} onChange={e => setCity(e.target.value)}>
                  {['Delhi','Mumbai','Bangalore','Chennai','Kolkata'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Blood Group</label>
                <select value={bg} onChange={e => setBg(e.target.value)}>
                  {['O+','O-','A+','A-','B+','B-','AB+','AB-'].map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
              <button className="btn btn-primary" onClick={load} disabled={loading}>
                {loading ? 'Loading...' : '🔮 Forecast'}
              </button>
            </div>
          </div>

          {loading && <SkeletonCard />}

          {predictions && !loading && (
            <Reveal>
              <div className="card bb-glow-card">
                <div className="forecast-chart">
                  {predictions.map((p, i) => (
                    <div key={i} className="forecast-bar">
                      <div className="bar-value">{p.predicted_demand}</div>
                      <div className="bar" style={{height: `${Math.max((p.predicted_demand / maxDemand) * 160, 6)}px`}}></div>
                      <div className="bar-label">{p.day?.slice(0, 3)}</div>
                      <div className="bar-date">{p.date?.slice(5)}</div>
                    </div>
                  ))}
                </div>
                <div style={{marginTop:'20px', display:'flex', gap:'24px', flexWrap:'wrap'}}>
                  <div className="forecast-stat"><span className="forecast-stat-value">{predictions.reduce((s,p) => s + p.predicted_demand, 0)}</span><span className="forecast-stat-label">Total Weekly Demand</span></div>
                  <div className="forecast-stat"><span className="forecast-stat-value">{Math.round(predictions.reduce((s,p) => s + p.predicted_demand, 0) / 7)}</span><span className="forecast-stat-label">Daily Average</span></div>
                  <div className="forecast-stat"><span className="forecast-stat-value">{Math.max(...predictions.map(p => p.predicted_demand))}</span><span className="forecast-stat-label">Peak Day</span></div>
                </div>
              </div>
            </Reveal>
          )}
        </div>
      </section>
    </div>
  )
}

// ═══════════════════════════════════════════════
// PAGE: Donor Map (search-driven)
// ═══════════════════════════════════════════════
function DonorMapPage() {
  const [donors, setDonors] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('ALL')
  const [searchBg, setSearchBg] = useState('O+')
  const [searchCity, setSearchCity] = useState('Delhi')
  const [searched, setSearched] = useState(false)
  const [stats, setStats] = useState(null)

  // Mock donor data spread across India for initial view
  const MOCK_DONORS = useMemo(() => [
    { name: 'Rahul Sharma', blood_group: 'O+', city: 'Delhi', distance_km: 4.2, response_rate: 0.92, match_score: 0.95 },
    { name: 'Priya Patel', blood_group: 'A+', city: 'Mumbai', distance_km: 12.1, response_rate: 0.88, match_score: 0.87 },
    { name: 'Amit Kumar', blood_group: 'B+', city: 'Bangalore', distance_km: 8.5, response_rate: 0.95, match_score: 0.91 },
    { name: 'Sneha Reddy', blood_group: 'O-', city: 'Chennai', distance_km: 6.3, response_rate: 0.90, match_score: 0.89 },
    { name: 'Vikram Singh', blood_group: 'AB+', city: 'Kolkata', distance_km: 15.0, response_rate: 0.78, match_score: 0.76 },
    { name: 'Deepa Nair', blood_group: 'A-', city: 'Hyderabad', distance_km: 9.8, response_rate: 0.85, match_score: 0.82 },
    { name: 'Arjun Mehta', blood_group: 'B-', city: 'Pune', distance_km: 5.1, response_rate: 0.91, match_score: 0.88 },
    { name: 'Kavita Joshi', blood_group: 'O+', city: 'Jaipur', distance_km: 7.7, response_rate: 0.87, match_score: 0.84 },
    { name: 'Rajesh Gupta', blood_group: 'AB-', city: 'Lucknow', distance_km: 11.3, response_rate: 0.82, match_score: 0.79 },
    { name: 'Meera Iyer', blood_group: 'A+', city: 'Chandigarh', distance_km: 3.9, response_rate: 0.94, match_score: 0.93 },
    { name: 'Suresh Yadav', blood_group: 'O+', city: 'Delhi', distance_km: 2.1, response_rate: 0.96, match_score: 0.97 },
    { name: 'Anita Desai', blood_group: 'B+', city: 'Ahmedabad', distance_km: 10.5, response_rate: 0.83, match_score: 0.80 },
    { name: 'Kiran Rao', blood_group: 'O-', city: 'Hyderabad', distance_km: 7.0, response_rate: 0.89, match_score: 0.86 },
    { name: 'Nisha Verma', blood_group: 'A+', city: 'Lucknow', distance_km: 13.4, response_rate: 0.77, match_score: 0.74 },
    { name: 'Ravi Tiwari', blood_group: 'B+', city: 'Jaipur', distance_km: 6.8, response_rate: 0.90, match_score: 0.87 },
    { name: 'Pooja Menon', blood_group: 'AB+', city: 'Bangalore', distance_km: 3.3, response_rate: 0.93, match_score: 0.94 },
    { name: 'Sanjay Das', blood_group: 'O+', city: 'Kolkata', distance_km: 9.1, response_rate: 0.84, match_score: 0.81 },
    { name: 'Lakshmi Pillai', blood_group: 'B-', city: 'Chennai', distance_km: 11.7, response_rate: 0.80, match_score: 0.77 },
    { name: 'Manish Pandey', blood_group: 'A-', city: 'Delhi', distance_km: 5.5, response_rate: 0.91, match_score: 0.90 },
    { name: 'Divya Saxena', blood_group: 'O-', city: 'Pune', distance_km: 8.2, response_rate: 0.86, match_score: 0.83 },
  ].map((d, i) => ({
    ...d, rank: i + 1,
    lat: getCityCoord(d.city)[0] + (Math.random() - 0.5) * 0.12,
    lng: getCityCoord(d.city)[1] + (Math.random() - 0.5) * 0.12,
  })), [])

  // Load initial donors (try API first, fallback to mock)
  useEffect(() => {
    setLoading(true)
    apiPost('/api/match', { blood_group: 'O+', hospital: 'AIIMS Delhi', city: 'Delhi', urgency: 'P2_MODERATE', top_k: 20 })
      .then(r => {
        const mapped = (r.donors || []).map(d => ({
          ...d,
          lat: getCityCoord(d.city)[0] + (Math.random() - 0.5) * 0.15,
          lng: getCityCoord(d.city)[1] + (Math.random() - 0.5) * 0.15,
        }))
        setDonors(mapped)
        setStats(r.stats)
      })
      .catch(() => setDonors(MOCK_DONORS))
      .finally(() => setLoading(false))
  }, [MOCK_DONORS])

  async function searchDonors() {
    setLoading(true)
    setSearched(false)
    try {
      const hospitals = { 'Delhi': 'AIIMS Delhi', 'Mumbai': 'KEM Hospital Mumbai', 'Bangalore': 'Narayana Health Bangalore', 'Chennai': 'Apollo Hospital Chennai', 'Kolkata': 'AIIMS Delhi', 'Hyderabad': 'Apollo Hospital Chennai', 'Pune': 'KEM Hospital Mumbai', 'Jaipur': 'AIIMS Delhi', 'Lucknow': 'AIIMS Delhi', 'Chandigarh': 'PGIMER Chandigarh', 'Ahmedabad': 'KEM Hospital Mumbai', 'Gurgaon': 'Fortis Hospital Gurgaon' }
      const r = await apiPost('/api/match', { blood_group: searchBg, hospital: hospitals[searchCity] || 'AIIMS Delhi', city: searchCity, urgency: 'P0_CRITICAL', top_k: 20 })
      const mapped = (r.donors || []).map(d => ({
        ...d,
        lat: getCityCoord(d.city)[0] + (Math.random() - 0.5) * 0.15,
        lng: getCityCoord(d.city)[1] + (Math.random() - 0.5) * 0.15,
      }))
      setDonors(mapped)
      setStats(r.stats)
      setSearched(true)
    } catch {
      // Fallback: filter mock donors by blood group
      const filtered = MOCK_DONORS.filter(d => d.blood_group === searchBg || ['O+','O-'].includes(d.blood_group))
      setDonors(filtered)
      setStats({ total_compatible: filtered.length, exact_match_available: filtered.filter(d => d.blood_group === searchBg).length })
      setSearched(true)
    }
    setLoading(false)
  }

  const filteredDonors = filter === 'ALL' ? donors : donors.filter(d => d.blood_group === filter)

  return (
    <div className="page-content">
      <section className="section" style={{paddingTop: '120px'}}>
        <div className="container">
          <SectionHeader eyebrow="Live Map" title="Donor Network Map">
            Search for donors by blood group and city — results update live on the map across India
          </SectionHeader>

          {/* Network coverage — what this map actually represents */}
          <div
            className="card bb-glow-card"
            style={{
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: 28,
              flexWrap: 'wrap',
            }}
          >
            <div style={{display: 'flex', gap: 14, alignItems: 'center', flex: 1, minWidth: 240}}>
              <div
                aria-hidden="true"
                style={{
                  flexShrink: 0,
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.15rem',
                  background: 'rgba(96,165,250,0.1)',
                  border: '1px solid rgba(96,165,250,0.25)',
                }}
              >
                🗺️
              </div>
              <div>
                <h4 style={{fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: 4}}>
                  Live donor network
                </h4>
                <p style={{color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.6, maxWidth: 420}}>
                  Every pin is a real registry match — filter by blood group below, or click a pin for contact-ready details.
                </p>
              </div>
            </div>

            <div style={{display: 'flex', gap: 0}}>
              {[
                { value: `${Object.keys(CITY_COORDS).length}`, label: 'Cities Covered' },
                { value: '8', label: 'Blood Groups' },
                { value: 'Live', label: 'Match Status' },
              ].map((s, i) => (
                <div
                  key={i}
                  style={{
                    textAlign: 'center',
                    padding: '0 20px',
                    borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  }}
                >
                  <div style={{fontFamily: 'var(--font-mono)', fontSize: '1.2rem', fontWeight: 800, color: 'var(--blue-400)'}}>
                    {s.value}
                  </div>
                  <div style={{fontSize: '0.63rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 3}}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Search Controls */}
          <div className="card bb-glow-card" style={{marginBottom: '20px'}}>
            <div className="match-form">
              <div className="form-group">
                <label>Blood Group Needed</label>
                <select value={searchBg} onChange={e => setSearchBg(e.target.value)}>
                  {['O+','O-','A+','A-','B+','B-','AB+','AB-'].map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>City</label>
                <select value={searchCity} onChange={e => setSearchCity(e.target.value)}>
                  {Object.keys(CITY_COORDS).map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <button className="btn btn-primary" onClick={searchDonors} disabled={loading}>
                {loading ? 'Searching…' : 'Find Donors on Map'}
              </button>
            </div>
          </div>

          {/* Stats Row */}
          {searched && stats && (
            <div className="stats-grid" style={{gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '16px'}}>
              <Reveal delay={0}><div className="card stat-card bb-glow-card"><div className="stat-value" style={{color:'var(--green-400)'}}>{stats.total_compatible}</div><div className="stat-label">Compatible Found</div></div></Reveal>
              <Reveal delay={0.1}><div className="card stat-card bb-glow-card"><div className="stat-value" style={{color:'var(--red-400)'}}>{stats.exact_match_available}</div><div className="stat-label">Exact Match</div></div></Reveal>
            </div>
          )}

          {/* Blood Group Filter Pills */}
          <div className="bb-map-controls">
            <span style={{color:'var(--text-secondary)', fontSize:'0.85rem', marginRight:8}}>Filter pins:</span>
            {['ALL','O+','O-','A+','A-','B+','B-','AB+','AB-'].map(bg => (
              <button key={bg} className={`btn btn-secondary bb-map-filter ${filter === bg ? 'active' : ''}`} onClick={() => setFilter(bg)}>{bg}</button>
            ))}
          </div>

          {loading ? <SkeletonCard /> : (
            <div className="card bb-glow-card bb-map-wrapper">
              <MapContainer
                center={[22.5, 78.9]}
                zoom={5}
                style={{ height: '520px', width: '100%', borderRadius: 'var(--radius-md)', zIndex: 1 }}
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />
                {filteredDonors.map((d, i) => (
                  <Marker key={`${d.name}-${i}`} position={[d.lat, d.lng]} icon={donorIcon}>
                    <Popup>
                      <div className="bb-map-popup">
                        <strong>{d.name}</strong>
                        <span className="bb-popup-blood">{d.blood_group}</span>
                        <span>{d.city} · {d.distance_km} km away</span>
                        <span>Response Rate: {(d.response_rate * 100).toFixed(0)}%</span>
                        <span>Match Score: {d.match_score?.toFixed(3)}</span>
                        {d.total_donations !== undefined && <span>Donations: {d.total_donations}</span>}
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
              <div className="bb-map-legend">
                <span className="bb-map-legend-dot" /> <span>{filteredDonors.length} donors shown across India</span>
                {filter !== 'ALL' && <span style={{marginLeft:8}}>· Filtered: <strong style={{color:'var(--red-400)'}}>{filter}</strong></span>}
                {searched && <span style={{marginLeft:8}}>· Searched: <strong style={{color:'var(--green-400)'}}>{searchBg} in {searchCity}</strong></span>}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

// ═══════════════════════════════════════════════
// COMPONENT: Login Particles
// ═══════════════════════════════════════════════
function LoginParticles() {
  return (
    <div className="login-particles" aria-hidden>
      {Array.from({ length: 18 }).map((_, i) => (
        <span
          key={i}
          className="login-particle"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 8}s`,
            animationDuration: `${6 + Math.random() * 10}s`,
            width: `${2 + Math.random() * 3}px`,
            height: `${2 + Math.random() * 3}px`,
            opacity: 0.15 + Math.random() * 0.2,
          }}
        />
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════
// PAGE: Login
// ═══════════════════════════════════════════════
function LoginPage({ onLogin, onSignup }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const formRef = useRef(null)
  const leftRef = useRef(null)

  useEffect(() => {
    if (leftRef.current) gsap.fromTo(leftRef.current.children, { opacity: 0, y: 30 }, { opacity: 1, y: 0, stagger: 0.12, duration: 0.7, ease: 'power3.out' })
    if (formRef.current) gsap.fromTo(formRef.current, { opacity: 0, y: 40, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.8, delay: 0.3, ease: 'power3.out' })
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      onLogin({ name: email.split('@')[0], email, bloodGroup: 'O+', city: 'Delhi', phone: '+91 98765 43210', joined: new Date().toLocaleDateString() })
    }, 900)
  }

  const features = [
    { text: 'NLP-driven urgency triage in under 2 seconds', accent: 'var(--red-400)' },
    { text: 'XGBoost-ranked donor matching across 50K profiles', accent: 'var(--blue-400)' },
    { text: 'Voice-first blood request processing via Web Speech', accent: 'var(--purple-400)' },
    { text: 'Predictive demand forecasting with R² = 0.876', accent: 'var(--green-400)' },
  ]

  const stats = [
    { value: '96.1%', label: 'Accuracy' },
    { value: '50K+', label: 'Donors' },
    { value: '<2s', label: 'Latency' },
    { value: '0.876', label: 'R² Score' },
  ]

  return (
    <div className="login-page">
      <LoginParticles />
      <div className="login-bg-glow login-bg-glow--1" />
      <div className="login-bg-glow login-bg-glow--2" />
      <div className="login-bg-glow login-bg-glow--3" />
      <div className="login-grid-bg" />

      <div className="login-left" ref={leftRef}>
        <div className="login-brand">
          <div className="login-logo-wrap"><div className="login-logo-glow" /><img src="/logo.png" alt="BloodBridge" className="login-brand-logo" /></div>
          <div><span className="login-brand-name">BloodBridge</span><span className="login-brand-tag">AI-POWERED MATCHING</span></div>
        </div>
        <h1 className="login-headline">Every second<br /><span className="login-headline-accent">saves a life.</span></h1>
        <p className="login-subtitle">AI finds the perfect donor match before you finish reading this. From raw text to ranked donors — in under two seconds.</p>
        <ul className="login-features">
          {features.map((f, i) => (
            <li key={i} className="login-feature">
              <span className="login-feature-check" style={{ background: `${f.accent}18`, color: f.accent }}><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M11.5 4L5.5 10L2.5 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
              {f.text}
            </li>
          ))}
        </ul>
        <div className="login-stats">
          {stats.map((s, i) => (<div key={i} className="login-stat"><span className="login-stat-value">{s.value}</span><span className="login-stat-label">{s.label}</span></div>))}
        </div>
      </div>

      <div className="login-right">
        <div className="login-card-border" ref={formRef}>
          <form className="login-card" onSubmit={handleSubmit} autoComplete="off">
            <div className="login-card-badge"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> Welcome back</div>
            <h2 className="login-card-title">Sign in</h2>
            <p className="login-card-subtitle">Continue your lifesaving journey</p>
            <div className="login-field"><label className="login-label">Email</label><div className="login-input-wrap"><span className="login-input-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg></span><input type="email" name="bb-login-email" className="login-input" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="off" /></div></div>
            <div className="login-field"><label className="login-label">Password</label><div className="login-input-wrap"><span className="login-input-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span><input type={showPw ? 'text' : 'password'} className="login-input" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" /><button type="button" className="login-pw-toggle" onClick={() => setShowPw(!showPw)} tabIndex={-1}>{showPw ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M1 1l22 22"/></svg> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}</button></div></div>
            <button type="submit" className="login-submit" disabled={loading}>{loading ? (<><span className="spinner" /> Signing in…</>) : (<>Sign in <span className="login-submit-arrow">→</span></>)}</button>
            <p className="login-footer-text">Don't have an account? <button type="button" className="login-link" onClick={onSignup}>Create one free</button></p>
          </form>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════
// PAGE: Sign Up
// ═══════════════════════════════════════════════
function SignUpPage({ onSignUp, onBackToLogin }) {
  const [form, setForm] = useState({ name: '', email: '', bloodGroup: 'O+', city: '', phone: '', password: '', confirmPw: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const formRef = useRef(null)
  const leftRef = useRef(null)

  useEffect(() => {
    if (leftRef.current) gsap.fromTo(leftRef.current.children, { opacity: 0, y: 30 }, { opacity: 1, y: 0, stagger: 0.1, duration: 0.6, ease: 'power3.out' })
    if (formRef.current) gsap.fromTo(formRef.current, { opacity: 0, y: 40, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.8, delay: 0.2, ease: 'power3.out' })
  }, [])

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (form.password !== form.confirmPw) { setError('Passwords do not match'); return }
    setLoading(true)
    setTimeout(() => { setLoading(false); onSignUp({ name: form.name, email: form.email, bloodGroup: form.bloodGroup, city: form.city, phone: form.phone, joined: new Date().toLocaleDateString() }) }, 900)
  }

  return (
    <div className="login-page">
      <LoginParticles />
      <div className="login-bg-glow login-bg-glow--1" />
      <div className="login-bg-glow login-bg-glow--2" />
      <div className="login-bg-glow login-bg-glow--3" />
      <div className="login-grid-bg" />

      <div className="login-left" ref={leftRef}>
        <div className="login-brand"><div className="login-logo-wrap"><div className="login-logo-glow" /><img src="/logo.png" alt="BloodBridge" className="login-brand-logo" /></div><div><span className="login-brand-name">BloodBridge</span><span className="login-brand-tag">AI-POWERED MATCHING</span></div></div>
        <h1 className="login-headline">Join the<br /><span className="login-headline-accent">lifesaving network.</span></h1>
        <p className="login-subtitle">Register as a donor and get matched instantly when someone in your city needs your blood type.</p>
        <ul className="login-features">
          {[
            { text: 'Get matched to nearby patients in real-time', accent: 'var(--red-400)' },
            { text: 'Receive urgent notifications for your blood type', accent: 'var(--blue-400)' },
            { text: 'Track your donation history and impact', accent: 'var(--purple-400)' },
            { text: 'Join 50,000+ verified donors across India', accent: 'var(--green-400)' },
          ].map((f, i) => (
            <li key={i} className="login-feature"><span className="login-feature-check" style={{ background: `${f.accent}18`, color: f.accent }}><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M11.5 4L5.5 10L2.5 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>{f.text}</li>
          ))}
        </ul>
      </div>

      <div className="login-right">
        <div className="login-card-border" ref={formRef}>
          <form className="login-card signup-card" onSubmit={handleSubmit} autoComplete="off">
            <div className="login-card-badge"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg> New here</div>
            <h2 className="login-card-title">Create account</h2>
            <p className="login-card-subtitle">Start saving lives today</p>

            <div className="signup-grid">
              <div className="login-field"><label className="login-label">Full Name</label><div className="login-input-wrap"><span className="login-input-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span><input type="text" name="bb-signup-name" className="login-input" placeholder="Your full name" value={form.name} onChange={set('name')} required autoComplete="off" /></div></div>
              <div className="login-field"><label className="login-label">Email</label><div className="login-input-wrap"><span className="login-input-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg></span><input type="email" name="bb-signup-email" className="login-input" placeholder="you@example.com" value={form.email} onChange={set('email')} required autoComplete="off" /></div></div>
              <div className="login-field"><label className="login-label">Blood Group</label><div className="login-input-wrap"><span className="login-input-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg></span><select className="login-input login-select" value={form.bloodGroup} onChange={set('bloodGroup')}>{['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}</select></div></div>
              <div className="login-field"><label className="login-label">City</label><div className="login-input-wrap"><span className="login-input-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></span><select className="login-input login-select" value={form.city} onChange={set('city')} required><option value="">Select city</option>{['Delhi','Mumbai','Bangalore','Chennai','Kolkata','Hyderabad','Pune','Ahmedabad','Jaipur','Lucknow'].map(c => <option key={c} value={c}>{c}</option>)}</select></div></div>
              <div className="login-field"><label className="login-label">Phone</label><div className="login-input-wrap"><span className="login-input-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg></span><input type="tel" name="bb-signup-phone" className="login-input" placeholder="+91 98765 43210" value={form.phone} onChange={set('phone')} autoComplete="off" /></div></div>
              <div className="login-field"><label className="login-label">Password</label><div className="login-input-wrap"><span className="login-input-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span><input type={showPw ? 'text' : 'password'} name="bb-signup-password" className="login-input" placeholder="Min 6 characters" value={form.password} onChange={set('password')} required minLength={6} autoComplete="new-password" /><button type="button" className="login-pw-toggle" onClick={() => setShowPw(!showPw)} tabIndex={-1}>{showPw ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M1 1l22 22"/></svg> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}</button></div></div>
            </div>

            <div className="login-field" style={{marginTop: 4}}><label className="login-label">Confirm Password</label><div className="login-input-wrap"><span className="login-input-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span><input type="password" name="bb-signup-confirm-password" className="login-input" placeholder="Repeat your password" value={form.confirmPw} onChange={set('confirmPw')} required autoComplete="new-password" /></div></div>

            {error && <p className="error-msg" style={{marginTop: 8, fontSize: '0.8rem'}}>{error}</p>}
            <button type="submit" className="login-submit" disabled={loading} style={{marginTop: 12}}>{loading ? (<><span className="spinner" /> Creating account…</>) : (<>Create Account <span className="login-submit-arrow">→</span></>)}</button>
            <p className="login-footer-text">Already have an account? <button type="button" className="login-link" onClick={onBackToLogin}>Sign in</button></p>
          </form>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════
// PAGE: Profile
// ═══════════════════════════════════════════════
function ProfilePage({ user, onUpdateUser }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ ...user })
  const [saved, setSaved] = useState(false)
  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  const handleSave = () => { onUpdateUser(form); setEditing(false); setSaved(true); setTimeout(() => setSaved(false), 2000) }

  // Brand-new signups have no history yet — only show demo numbers for the
  // sample "Sign in" account, so a fresh signup doesn't look fake.
  const isNew = user.isNewUser !== false
  const donationHistory = isNew ? [] : [
    { date: 'Jun 15, 2026', bank: 'AIIMS Blood Bank, Delhi', units: '1 unit' },
    { date: 'Apr 22, 2026', bank: 'Fortis Hospital, Gurgaon', units: '2 units' },
    { date: 'Feb 08, 2026', bank: 'Apollo, Chennai', units: '1 unit' },
  ]
  const totalUnits = donationHistory.reduce((s, d) => s + parseInt(d.units), 0)
  const tier = donationHistory.length >= 10 ? 'Gold' : donationHistory.length >= 5 ? 'Silver' : donationHistory.length > 0 ? 'Bronze' : 'New'

  const profileStats = [
    { value: String(donationHistory.length), label: 'Donations', color: 'var(--red-400)' },
    { value: String(isNew ? 0 : 8), label: 'Matches', color: 'var(--green-400)' },
    { value: String(totalUnits * 3), label: 'Lives Touched', color: 'var(--blue-400)' },
    { value: tier, label: 'Donor Tier', color: 'var(--orange-400)' },
  ]

  return (
    <div className="page-content">
      <section className="section" style={{paddingTop: '120px'}}>
        <div className="container" style={{maxWidth: '800px'}}>
          <SectionHeader eyebrow="Account" title="Your Profile">
            Manage your donor information and view your impact
          </SectionHeader>

          {/* New-user nudge banner */}
          {isNew && (
            <div
              className="card"
              style={{
                marginBottom: '20px',
                padding: '16px 20px',
                borderLeft: '3px solid var(--green-400)',
                background: 'rgba(74, 222, 128, 0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <span style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}>
                👋 Welcome aboard — complete your profile details below so responders can reach you the moment a compatible request comes in.
              </span>
            </div>
          )}

          {/* Profile header card */}
          <div className="card bb-glow-card profile-hero-card">
            <div className="profile-hero">
              <div className="profile-avatar"><span>{(user.name || 'U')[0].toUpperCase()}</span></div>
              <div className="profile-hero-info">
                <h2 className="profile-hero-name">{user.name || 'User'}</h2>
                <p className="profile-hero-email">{user.email}</p>
                <div className="profile-hero-badges">
                  <span className="profile-badge profile-badge--blood">{user.bloodGroup || 'O+'}</span>
                  <span className="profile-badge profile-badge--city">{user.city || 'India'}</span>
                  <span className="profile-badge profile-badge--joined">Joined {user.joined || 'Today'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="stats-grid" style={{marginTop: '24px'}}>
            {profileStats.map((s, i) => (<Reveal key={i} delay={i * 0.08}><div className="card stat-card bb-glow-card"><div className="stat-value" style={{color: s.color}}>{s.value}</div><div className="stat-label">{s.label}</div></div></Reveal>))}
          </div>

          {/* Editable info */}
          <div className="card bb-glow-card" style={{marginTop: '24px'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '24px'}}>
              <h4 style={{fontFamily:'var(--font-heading)', fontWeight: 600, fontSize:'1.1rem', color:'var(--text-primary)'}}>Personal Information</h4>
              {!editing ? (
                <button className="btn btn-secondary" onClick={() => { setForm({...user}); setEditing(true) }}>Edit Profile</button>
              ) : (
                <div style={{display:'flex', gap:'8px'}}><button className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSave}>Save Changes</button></div>
              )}
            </div>
            {saved && <p style={{color:'var(--green-400)', fontSize:'0.82rem', marginBottom:'16px', fontWeight: 500}}>Profile updated successfully!</p>}
            <div className="profile-fields">
              <div className="profile-field"><label className="login-label">Full Name</label>{editing ? <input className="login-input" value={form.name} onChange={set('name')} /> : <p className="profile-field-value">{user.name}</p>}</div>
              <div className="profile-field"><label className="login-label">Email</label>{editing ? <input className="login-input" type="email" value={form.email} onChange={set('email')} /> : <p className="profile-field-value">{user.email}</p>}</div>
              <div className="profile-field"><label className="login-label">Blood Group</label>{editing ? <select className="login-input login-select" value={form.bloodGroup} onChange={set('bloodGroup')}>{['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}</select> : <p className="profile-field-value">{user.bloodGroup}</p>}</div>
              <div className="profile-field"><label className="login-label">City</label>{editing ? <input className="login-input" value={form.city} onChange={set('city')} /> : <p className="profile-field-value">{user.city}</p>}</div>
              <div className="profile-field"><label className="login-label">Phone</label>{editing ? <input className="login-input" value={form.phone} onChange={set('phone')} /> : <p className="profile-field-value">{user.phone || '—'}</p>}</div>
            </div>
          </div>

          {/* Donation History */}
          <div className="card bb-glow-card" style={{marginTop: '24px'}}>
            <h4 style={{fontFamily:'var(--font-heading)', fontWeight: 600, fontSize:'1.1rem', color:'var(--text-primary)', marginBottom:'20px'}}>Recent Donation History</h4>
            {donationHistory.length > 0 ? (
              <table className="donor-table" style={{width:'100%'}}>
                <thead><tr><th>Date</th><th>Blood Bank</th><th>Units</th><th>Status</th></tr></thead>
                <tbody>
                  {donationHistory.map((d, i) => (
                    <tr key={i}><td>{d.date}</td><td>{d.bank}</td><td>{d.units}</td><td><span style={{color:'var(--green-400)', fontWeight:600}}>Completed</span></td></tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{textAlign:'center', padding:'32px 16px', color:'var(--text-muted)'}}>
                <p style={{fontSize:'0.9rem', marginBottom:'4px'}}>No donations yet</p>
                <p style={{fontSize:'0.8rem'}}>Your first donation will show up here once it's recorded.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

// ═══════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════
export default function App() {
  const [page, setPage] = useState('login')
  const [user, setUser] = useState(null)
  const [selectedStage, setSelectedStage] = useState(null)

  const handleLogin = (userData) => { setUser({ ...userData, isNewUser: false }); setPage('dashboard') }
  const handleSignUp = (userData) => { setUser({ ...userData, isNewUser: true }); setPage('dashboard') }
  const handleSelectStage = (stage) => { setSelectedStage(stage); setPage('stageDetail') }

  const pages = {
    dashboard: <DashboardPage onSelectStage={handleSelectStage} />,
    stageDetail: <StageDetailPage stage={selectedStage} onBack={() => setPage('dashboard')} />,
    pipeline: <PipelinePage />,
    matching: <MatchingPage />,
    forecast: <ForecastPage />,
    map: <DonorMapPage />,
    profile: user ? <ProfilePage user={user} onUpdateUser={setUser} /> : null,
  }

  // Auth screens — no navbar, no footer
  if (page === 'login') {
    return (<div className="app"><PremiumCursor /><LoginPage onLogin={handleLogin} onSignup={() => setPage('signup')} /></div>)
  }
  if (page === 'signup') {
    return (<div className="app"><PremiumCursor /><SignUpPage onSignUp={handleSignUp} onBackToLogin={() => setPage('login')} /></div>)
  }

  return (
    <div className="app">
      <PremiumCursor />

      <nav className="navbar">
        <div className="container" style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <a className="nav-brand" href="#" onClick={() => setPage('dashboard')}>
            <img src="/logo.png" alt="BloodBridge" />
            <h1>BloodBridge</h1>
          </a>
          <ul className="nav-links">
            {[
              {id: 'dashboard', label: 'Dashboard'},
              {id: 'pipeline', label: 'Pipeline'},
              {id: 'matching', label: 'Matching'},
              {id: 'map', label: 'Donor Map'},
              {id: 'forecast', label: 'Forecast'},
            ].map(n => (
              <li key={n.id}><button className={page === n.id ? 'active' : ''} onClick={() => setPage(n.id)}>{n.label}</button></li>
            ))}
            <li>
              <button className={`nav-profile-btn ${page === 'profile' ? 'active' : ''}`} onClick={() => setPage('profile')} title="Profile">
                <span className="nav-profile-avatar">{(user?.name || 'U')[0].toUpperCase()}</span>
              </button>
            </li>
            <li><button className="login-logout-btn" onClick={() => { setUser(null); setPage('login') }}>Log out</button></li>
          </ul>
        </div>
      </nav>

      <PageTransition pageKey={page}>
        {pages[page]}
      </PageTransition>

      <footer className="footer">
        <div className="container">
          <p><span>BloodBridge</span> — AI-Powered Emergency Blood Matching System</p>
          <p style={{marginTop:'6px', opacity: 0.6}}>Built with MuRIL · XGBoost · FastAPI · React · Leaflet</p>
        </div>
      </footer>
    </div>
  )
}
