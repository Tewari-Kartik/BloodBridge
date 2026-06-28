import { useState, useEffect } from 'react'
import './index.css'

const API = 'http://127.0.0.1:8000'

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
// PAGE: Dashboard
// ═══════════════════════════════════════════════
function DashboardPage() {
  const [health, setHealth] = useState(null)
  const [backendOnline, setBackendOnline] = useState(false)

  useEffect(() => {
    apiGet('/api/health')
      .then(h => { setHealth(h); setBackendOnline(true) })
      .catch(() => setBackendOnline(false))
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
        <div className="container hero-content">
          <div className="hero-badge">
            <span className={`dot ${backendOnline ? '' : 'offline'}`}></span>
            {backendOnline ? 'AI System Online' : 'Backend Offline — Start the server'}
          </div>
          <h2>
            Where AI Meets<br />
            <span className="gradient-text">Lifesaving Precision</span>
          </h2>
          <p>
            5-stage ML pipeline that processes blood requests in real-time —
            from urgency triage to optimal donor matching.
          </p>
          <div className="hero-stats">
            <div className="hero-stat"><div className="value">96.1%</div><div className="label">Triage Accuracy</div></div>
            <div className="hero-stat"><div className="value">50K</div><div className="label">Donors Indexed</div></div>
            <div className="hero-stat"><div className="value">1.08s</div><div className="label">Pipeline Latency</div></div>
            <div className="hero-stat"><div className="value">0.876</div><div className="label">Forecast R²</div></div>
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
          <div className="stats-grid">
            <div className="card stat-card"><div className="icon">🔬</div><div className="stat-value" style={{color:'var(--red-400)'}}>5</div><div className="stat-label">ML Stages</div></div>
            <div className="card stat-card"><div className="icon">✅</div><div className="stat-value" style={{color:'var(--green-400)'}}>{health ? Object.values(health.models_loaded).filter(Boolean).length : '—'}/5</div><div className="stat-label">Models Loaded</div></div>
            <div className="card stat-card"><div className="icon">🩸</div><div className="stat-value" style={{color:'var(--blue-400)'}}>1,507</div><div className="stat-label">Messages Trained</div></div>
            <div className="card stat-card"><div className="icon">⚡</div><div className="stat-value" style={{color:'var(--purple-400)'}}>7</div><div className="stat-label">API Endpoints</div></div>
          </div>

          {/* Pipeline Stages */}
          <div className="section-header" style={{marginTop: '40px'}}>
            <h3>🔗 ML Pipeline Architecture</h3>
          </div>
          <div className="stages-grid">
            {stages.map((s, i) => (
              <div key={i} className="card stage-card">
                <div className="stage-number">Stage {i + 1}</div>
                <div className="stage-icon">{s.icon}</div>
                <h4>{s.name}</h4>
                <p>{s.desc}</p>
                <div className="stage-metric">
                  <span className="stage-metric-value" style={{color: s.color}}>{s.metric}</span>
                  <span className="stage-metric-label">{s.metricLabel}</span>
                </div>
              </div>
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
    try {
      const r = await apiPost('/api/pipeline', { message, top_k_donors: 5 })
      setResult(r)
    } catch (e) {
      setError('Backend not reachable. Start it with: uv run uvicorn backend.api.main:app --port 8000')
    }
    setLoading(false)
  }

  return (
    <div className="page-content">
      <section className="section" style={{paddingTop: '120px'}}>
        <div className="container">
          <div className="section-header">
            <h3>🧪 Live Pipeline Demo</h3>
            <p>Enter a blood request message to see all 5 ML stages process it in real-time</p>
          </div>

          {/* Input Area */}
          <div className="card" style={{marginBottom: '24px'}}>
            <div className="textarea-wrap">
              <span className="textarea-icon">🩸</span>
              <textarea
                placeholder="Describe the blood requirement... e.g. Need 3 units O- at AIIMS Delhi for accident victim"
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={4}
              />
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

          {/* Results */}
          {result && (
            <div className="results-grid">
              {/* Stage 1 */}
              <div className="card result-card">
                <div className="result-card-header">
                  <span className="result-stage">Stage 1</span>
                  <h4>Preprocessing</h4>
                </div>
                <div className="result-body">
                  <div className="result-row"><span className="result-label">Cleaned</span><span className="result-value mono">{result.preprocessing?.cleaned}</span></div>
                  <div className="result-row"><span className="result-label">Language</span><span className="result-value">{result.preprocessing?.language?.language} ({(result.preprocessing?.language?.confidence * 100).toFixed(0)}%)</span></div>
                </div>
              </div>

              {/* Stage 2 */}
              {result.triage && (
                <div className="card result-card">
                  <div className="result-card-header">
                    <span className="result-stage">Stage 2</span>
                    <h4>Urgency Classification</h4>
                  </div>
                  <div className="result-body">
                    <div style={{display:'flex', alignItems:'center', gap:'16px', marginBottom:'16px'}}>
                      <span className={`urgency-badge urgency-${result.triage.urgency}`}>
                        {result.triage.urgency}
                      </span>
                      <span style={{color:'var(--text-muted)', fontSize:'0.85rem'}}>
                        {result.triage.is_critical ? '⚠️ Critical — Immediate action needed' : 'Non-critical request'}
                      </span>
                    </div>
                    <div className="prob-bars">
                      {result.triage.probabilities && Object.entries(result.triage.probabilities).map(([label, prob]) => (
                        <div key={label} className="prob-row">
                          <span className="prob-label">{label}</span>
                          <div className="prob-bar-bg">
                            <div className="prob-bar-fill" style={{width: `${prob * 100}%`}}></div>
                          </div>
                          <span className="prob-value">{(prob * 100).toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Stage 3 */}
              <div className="card result-card">
                <div className="result-card-header">
                  <span className="result-stage">Stage 3</span>
                  <h4>Named Entities ({result.entities?.entity_count || 0} found)</h4>
                </div>
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

              {/* Stage 4 */}
              {result.matching && (
                <div className="card result-card full-width">
                  <div className="result-card-header">
                    <span className="result-stage">Stage 4</span>
                    <h4>Donor Matching — {result.matching.stats?.total_compatible} compatible donors found</h4>
                  </div>
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
              )}

              {/* Performance */}
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

          <div className="card" style={{marginBottom: '24px'}}>
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

          {result && (
            <>
              <div className="stats-grid" style={{gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '24px'}}>
                <div className="card stat-card"><div className="stat-value" style={{color:'var(--green-400)'}}>{result.stats?.total_compatible}</div><div className="stat-label">Compatible Donors</div></div>
                <div className="card stat-card"><div className="stat-value" style={{color:'var(--red-400)'}}>{result.stats?.exact_match_available}</div><div className="stat-label">Exact Match</div></div>
                <div className="card stat-card"><div className="stat-value" style={{color:'var(--blue-400)'}}>{result.stats?.compatible_groups?.join(', ')}</div><div className="stat-label">Compatible Groups</div></div>
              </div>
              <div className="card">
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

          <div className="card" style={{marginBottom: '24px'}}>
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

          {predictions && (
            <div className="card">
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
                <div className="forecast-stat">
                  <span className="forecast-stat-value">{predictions.reduce((s,p) => s + p.predicted_demand, 0)}</span>
                  <span className="forecast-stat-label">Total Weekly Demand</span>
                </div>
                <div className="forecast-stat">
                  <span className="forecast-stat-value">{Math.round(predictions.reduce((s,p) => s + p.predicted_demand, 0) / 7)}</span>
                  <span className="forecast-stat-label">Daily Average</span>
                </div>
                <div className="forecast-stat">
                  <span className="forecast-stat-value">{Math.max(...predictions.map(p => p.predicted_demand))}</span>
                  <span className="forecast-stat-label">Peak Day</span>
                </div>
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
  }

  return (
    <div className="app">
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

      {pages[page]}

      <footer className="footer">
        <div className="container">
          <p><span>BloodBridge</span> — AI-Powered Emergency Blood Matching System</p>
          <p style={{marginTop:'4px'}}>Built with MuRIL · XGBoost · FastAPI · React</p>
        </div>
      </footer>
    </div>
  )
}
