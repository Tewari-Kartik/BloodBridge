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
function DashboardPage() {
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
    { icon: '🔧', name: 'Preprocessing', desc: '1,507 messages cleaned in 0.38s', metric: '91.4%', metricLabel: 'BG Extraction', color: 'var(--red-400)' },
    { icon: '🎯', name: 'Urgency Classifier', desc: 'MuRIL fine-tuned, 4-class triage', metric: '96.1%', metricLabel: 'Accuracy', color: 'var(--green-400)' },
    { icon: '🏷️', name: 'Named Entity Recognition', desc: '7 entity types, hybrid regex+gazetteer', metric: '100%', metricLabel: 'BG Accuracy', color: 'var(--blue-400)' },
    { icon: '🤝', name: 'Donor Matching', desc: 'XGBoost ranker across 50K donors', metric: '50K', metricLabel: 'Donors', color: 'var(--purple-400)' },
    { icon: '📈', name: 'Demand Forecasting', desc: 'XGBoost regressor, 27 features', metric: '0.876', metricLabel: 'R² Score', color: 'var(--orange-400)' },
  ]

  return (
    <div className="page-content">
      {/* Hero */}
      <section className="hero">
        <HeroParticles />
        <div className="container hero-content">
          <div className="hero-badge">
            <span className={`dot ${backendOnline ? '' : 'offline'}`}></span>
            {backendOnline ? 'AI System Online' : 'Backend Offline — Start the server'}
          </div>
          <h2>
            Where AI Meets<br />
            <span className="gradient-text"><TypeWriter text="Lifesaving Precision" speed={70} /></span>
          </h2>
          <p>
            5-stage ML pipeline that processes blood requests in real-time —
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

      {/* Stats */}
      <section className="section">
        <div className="container">
          <div className="section-header">
            <h3>📊 System Overview</h3>
            <p>Backend: {backendOnline
              ? <><span className="status-dot online"></span> Online ({health?.startup_time_s}s startup)</>
              : <><span className="status-dot offline"></span> Offline — run: <code>uv run uvicorn backend.api.main:app --port 8000</code></>
            }</p>
          </div>
          {loading ? (
            <div className="stats-grid">
              <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
            </div>
          ) : (
            <div className="stats-grid">
              <Reveal delay={0}><div className="card stat-card bb-glow-card"><div className="icon">🔬</div><div className="stat-value" style={{color:'var(--red-400)'}}>5</div><div className="stat-label">ML Stages</div></div></Reveal>
              <Reveal delay={0.1}><div className="card stat-card bb-glow-card"><div className="icon">✅</div><div className="stat-value" style={{color:'var(--green-400)'}}>{health ? Object.values(health.models_loaded).filter(Boolean).length : '—'}/5</div><div className="stat-label">Models Loaded</div></div></Reveal>
              <Reveal delay={0.2}><div className="card stat-card bb-glow-card"><div className="icon">🩸</div><div className="stat-value" style={{color:'var(--blue-400)'}}>1,507</div><div className="stat-label">Messages Trained</div></div></Reveal>
              <Reveal delay={0.3}><div className="card stat-card bb-glow-card"><div className="icon">⚡</div><div className="stat-value" style={{color:'var(--purple-400)'}}>7</div><div className="stat-label">API Endpoints</div></div></Reveal>
            </div>
          )}

          {/* Pipeline Stages */}
          <div className="section-header" style={{marginTop: '40px'}}>
            <h3>🔗 ML Pipeline Architecture</h3>
          </div>
          <div className="stages-grid">
            {stages.map((s, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <div className="card stage-card bb-glow-card" style={{height:'100%'}}>
                  <div className="stage-number">Stage {i + 1}</div>
                  <div className="stage-icon">{s.icon}</div>
                  <h4>{s.name}</h4>
                  <p>{s.desc}</p>
                  <div className="stage-metric">
                    <span className="stage-metric-value" style={{color: s.color}}>{s.metric}</span>
                    <span className="stage-metric-label">{s.metricLabel}</span>
                  </div>
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
    { label: '🔴 Critical', text: 'URGENT! Need 3 units O- blood at AIIMS Delhi. Accident victim in ICU. Call 9876543210' },
    { label: '🟠 High', text: 'My sister needs 2 units AB+ for surgery tomorrow at Fortis Gurgaon. Contact 7012345678' },
    { label: '🟡 Moderate', text: 'Thalassemia patient needs regular B+ transfusion. 2 units at KEM Hospital Mumbai by Thursday.' },
    { label: '🔵 Info', text: 'Blood donation camp this Sunday at Rotary Club, Delhi. Free health checkup for all donors!' },
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
          <div className="section-header">
            <h3>🧪 Live Pipeline Demo</h3>
            <p>Enter a blood request message to see all 5 ML stages process it in real-time</p>
          </div>

          <div className="card bb-glow-card" style={{marginBottom: '24px'}}>
            <div className="textarea-wrap" style={{position:'relative'}}>
              <span className="textarea-icon">🩸</span>
              <textarea
                placeholder="Describe the blood requirement... e.g. Need 3 units O- at AIIMS Delhi for accident victim"
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={4}
              />
              {supported && (
                <button className="bb-mic-btn" onClick={toggleListen} title={listening ? 'Stop' : 'Dictate'} data-cursor>
                  <span className={`bb-mic-icon ${listening ? 'active' : ''}`}>{listening ? '⏹' : '🎤'}</span>
                  {listening && <span className="bb-mic-pulse" />}
                </button>
              )}
            </div>
            <div style={{display:'flex', gap:'10px', marginTop:'16px', flexWrap:'wrap', alignItems:'center'}}>
              <button className="btn btn-primary" onClick={runPipeline} disabled={loading || !message.trim()}>
                {loading ? <><span className="spinner"></span> Processing...</> : '▶ Run Full Pipeline'}
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
          <div className="section-header">
            <h3>🤝 Donor Matching Engine</h3>
            <p>Search 50,000 registered donors using XGBoost-powered ranking</p>
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
          <div className="section-header">
            <h3>📈 7-Day Demand Forecast</h3>
            <p>XGBoost time-series model predicting blood demand across Indian cities (R² = 0.876, MAE = 1.99 units)</p>
          </div>

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
          <div className="section-header">
            <h3>🗺️ Donor Network Map</h3>
            <p>Search for donors by blood group and city — results update live on the map across India</p>
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
                {loading ? 'Searching...' : '🔍 Find Donors on Map'}
              </button>
            </div>
          </div>

          {/* Stats Row */}
          {searched && stats && (
            <div className="stats-grid" style={{gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '16px'}}>
              <Reveal delay={0}><div className="card stat-card bb-glow-card"><div className="stat-value" style={{color:'var(--green-400)'}}>{stats.total_compatible}</div><div className="stat-label">Compatible Found</div></div></Reveal>
              <Reveal delay={0.1}><div className="card stat-card bb-glow-card"><div className="stat-value" style={{color:'var(--red-400)'}}>{stats.exact_match_available}</div><div className="stat-label">Exact Match</div></div></Reveal>
              <Reveal delay={0.2}><div className="card stat-card bb-glow-card"><div className="stat-value" style={{color:'var(--blue-400)'}}>{searchBg}</div><div className="stat-label">Searching For</div></div></Reveal>
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
                        <span>📍 {d.city} · {d.distance_km} km away</span>
                        <span>📞 Response Rate: {(d.response_rate * 100).toFixed(0)}%</span>
                        <span>⭐ Match Score: {d.match_score?.toFixed(3)}</span>
                        {d.total_donations !== undefined && <span>🩸 Donations: {d.total_donations}</span>}
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
// MAIN APP
// ═══════════════════════════════════════════════
export default function App() {
  const [page, setPage] = useState('dashboard')

  const pages = {
    dashboard: <DashboardPage />,
    pipeline: <PipelinePage />,
    matching: <MatchingPage />,
    forecast: <ForecastPage />,
    map: <DonorMapPage />,
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
              {id: 'dashboard', label: 'Dashboard', icon: '📊'},
              {id: 'pipeline', label: 'Pipeline', icon: '🧪'},
              {id: 'matching', label: 'Matching', icon: '🤝'},
              {id: 'map', label: 'Donor Map', icon: '🗺️'},
              {id: 'forecast', label: 'Forecast', icon: '📈'},
            ].map(n => (
              <li key={n.id}>
                <button className={page === n.id ? 'active' : ''} onClick={() => setPage(n.id)}>
                  {n.icon} {n.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <PageTransition pageKey={page}>
        {pages[page]}
      </PageTransition>

      <footer className="footer">
        <div className="container">
          <p><span>BloodBridge</span> — AI-Powered Emergency Blood Matching System</p>
          <p style={{marginTop:'4px'}}>Built with MuRIL · XGBoost · FastAPI · React · Leaflet</p>
        </div>
      </footer>
    </div>
  )
}
