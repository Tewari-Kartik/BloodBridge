<div align="center">

# 🩸 BloodBridge

### *From a panicked message to a matched donor — in under two seconds.*

<br/>

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.138-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![XGBoost](https://img.shields.io/badge/XGBoost-3.3-FF6600?style=for-the-badge)](https://xgboost.ai)
[![MuRIL](https://img.shields.io/badge/MuRIL-Transformer-CC0000?style=for-the-badge)](https://huggingface.co/google/muril-base-cased)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

<br/>

> **BloodBridge** is a real-time, AI-powered emergency blood matching system — a 5-stage ML pipeline that triages requests in milliseconds, extracts critical entities from multilingual messages (Hindi, English, Hinglish), and ranks 50,000 donors using medical compatibility rules and location intelligence.

<br/>

---

</div>

## 🩸 Why BloodBridge?

Blood requests arrive in panic — misspelled, code-switched, incomplete. A nurse typing from a crowded ICU won't write clean English. A patient's relative sending a WhatsApp message won't follow a form. BloodBridge was built for the real world: messy, multilingual, urgent.

The pipeline processes a raw blood request message end-to-end in **~1.08 seconds** — from noisy text to a ranked shortlist of compatible, nearby donors ready to be contacted.

---

## ⚡ Pipeline at a Glance

```
                          A SINGLE BLOOD REQUEST MESSAGE
                                        │
                                        ▼
              ╔══════════════════════════════════════════╗
              ║  STAGE 1 · PREPROCESSING                 ║
              ║  ─────────────────────────────────────   ║
              ║  Clean noise · Mask phones · Detect       ║
              ║  language (Hindi / English / Hinglish)    ║
              ╚══════════════════════╦═══════════════════╝
                                     │
                                     ▼
              ╔══════════════════════════════════════════╗
              ║  STAGE 2 · URGENCY TRIAGE                ║
              ║  ─────────────────────────────────────   ║
              ║  Fine-tuned MuRIL classifies P0–P3        ║
              ║  Accuracy 96.1%  ·  P0 Recall 94.6%      ║
              ╚══════════════════════╦═══════════════════╝
                                     │
                                     ▼
              ╔══════════════════════════════════════════╗
              ║  STAGE 3 · NAMED ENTITY RECOGNITION      ║
              ║  ─────────────────────────────────────   ║
              ║  7 entities: blood group, units, city,    ║
              ║  hospital, condition, contact, date       ║
              ╚══════════════════════╦═══════════════════╝
                                     │
                                     ▼
              ╔══════════════════════════════════════════╗
              ║  STAGE 4 · DONOR MATCHING                ║
              ║  ─────────────────────────────────────   ║
              ║  XGBoost ranker scores 50K donors on      ║
              ║  distance · compatibility · recency       ║
              ╚══════════════════════╦═══════════════════╝
                                     │
                                     ▼
              ╔══════════════════════════════════════════╗
              ║  STAGE 5 · DEMAND FORECASTING            ║
              ║  ─────────────────────────────────────   ║
              ║  Predicts future blood demand by city     ║
              ║  and type · R² = 0.876                   ║
              ╚══════════════════════╦═══════════════════╝
                                     │
                                     ▼
                          RANKED DONOR SHORTLIST
                          READY IN ~1.08 SECONDS
```

---

## 📊 Model Scoreboard

| Stage | Model | What It Does | Score |
|-------|-------|-------------|-------|
| 🔤 Preprocessing | Rule-based + langdetect | Cleans + language-routes raw messages | — |
| 🚨 Urgency Triage | MuRIL (fine-tuned) | 4-class P0–P3 classification | **96.1% acc · 94.6% P0 recall** |
| 🏷️ NER | Hybrid Regex + Gazetteer | Extracts 7 clinical entity types | **100% blood group accuracy** |
| 🤝 Donor Matching | XGBoost Ranker | Ranks 50,000 donors in real-time | **50K donors indexed** |
| 📈 Demand Forecast | XGBoost Regressor | Multi-step blood supply prediction | **R² = 0.876** |
| ⚙️ Full Pipeline | End-to-End | Raw text → ranked donors | **~1.08s latency** |

---

## 🚀 Getting Started

### Prerequisites

- Python **3.12+**
- [`uv`](https://docs.astral.sh/uv/) — fast Python package manager
- Node.js **18+** — for the React frontend

### 1 · Clone & Install

```bash
git clone https://github.com/<your-username>/bloodbridge.git
cd bloodbridge

# Install Python dependencies
uv sync

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 2 · Generate Data & Train Models

```bash
# Generate synthetic datasets
uv run python data/synthetic/generate_messages.py
uv run python data/synthetic/generate_donors.py
uv run python data/synthetic/generate_timeseries.py

# Train urgency classifier
# ⏱ ~5 hours on CPU · ~30 min on GPU
uv run python backend/ml/triage/train.py

# Train matching & forecasting models (takes seconds)
uv run python backend/ml/matching/run_matching.py
uv run python backend/ml/forecasting/run_forecast.py
```

### 3 · Run

```bash
# Terminal 1 — Backend API (port 8000)
uv run uvicorn backend.api.main:app --port 8000

# Terminal 2 — Frontend (port 5173)
cd frontend && npm run dev
```

Open **http://localhost:5173** 🎉

### 🐳 One-Command Docker Deploy

```bash
docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| Interactive Docs | http://localhost:8000/docs |

---

## 🔗 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check + model load status |
| `GET` | `/api/stats` | Live system statistics |
| `POST` | `/api/preprocess` | Clean text + detect language |
| `POST` | `/api/triage` | Classify urgency (P0 – P3) |
| `POST` | `/api/ner` | Extract 7 clinical entities |
| `POST` | `/api/match` | Find & rank compatible donors |
| `POST` | `/api/forecast` | Predict blood demand by city + type |
| `POST` | `/api/pipeline` | ⚡ Full end-to-end pipeline |

---

## 📁 Project Structure

```
bloodbridge/
│
├── backend/
│   ├── api/
│   │   ├── main.py             # FastAPI app + model loading
│   │   └── schemas.py          # Pydantic request/response schemas
│   │
│   └── ml/
│       ├── preprocessing/      # Stage 1 · Text cleaning, language detection
│       ├── triage/             # Stage 2 · MuRIL urgency classifier
│       ├── ner/                # Stage 3 · Entity extraction engine
│       ├── matching/           # Stage 4 · XGBoost donor ranker
│       ├── forecasting/        # Stage 5 · Demand prediction
│       └── models/             # Saved model weights (.pt, .json, .pkl)
│
├── data/
│   ├── synthetic/              # Generators for messages, donors, time-series
│   └── processed/              # Cleaned + train/val/test splits
│
├── frontend/                   # React 19 dashboard (Vite)
├── docker/                     # Dockerfiles + nginx config
├── docker-compose.yml
└── pyproject.toml
```

---

## 🧠 ML Design Decisions

### Stage 1 — Preprocessing
Text cleaning, phone number masking (privacy), blood group regex extraction, and language detection to route messages through the right embeddings. Handles the trilingual reality of Indian healthcare communication: Hindi, English, and Hinglish.

### Stage 2 — Urgency Triage
Fine-tuned [MuRIL](https://huggingface.co/google/muril-base-cased) (Google's multilingual model purpose-built for Indian languages) on 1,507 synthetic blood requests. 4-class classification (P0 = critical → P3 = routine) with weighted cross-entropy loss to handle severe class imbalance — because missing a P0 is never acceptable.

### Stage 3 — Named Entity Recognition
A hybrid approach by design: regex for structured entities (blood groups like `O+`, phone numbers, unit counts), hospital and city gazetteers, and keyword matching for medical conditions. No neural NER needed when rules are precise — and rules are interpretable.

### Stage 4 — Donor Matching
XGBoost ranker scoring 50,000 donors on 7 features: haversine distance, full medical blood compatibility (including cross-type donation rules), response rate history, time since last donation, and blood group rarity weighting. Returns a ranked shortlist in real-time.

### Stage 5 — Demand Forecasting
XGBoost regressor with 27 engineered features: calendar signals (day, month, weekends, festivals), lag features (1/7/14/30 day windows), rolling averages, and city + blood group encodings. Multi-step auto-regressive prediction for supply chain planning.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| NLP / Transformers | PyTorch · HuggingFace Transformers · MuRIL |
| ML / Ranking | XGBoost · scikit-learn |
| API | FastAPI · Uvicorn |
| Frontend | React 19 · Vite |
| Deployment | Docker · nginx |
| Packaging | uv (Python) · npm (Node) |

---

## 🤝 Contributing

Pull requests are welcome. For major changes, open an issue first to discuss what you'd like to change. Please make sure to update tests as appropriate.

---

## 📄 License

[MIT](LICENSE) — free to use, modify, and distribute.

---

<div align="center">

**Built to save lives through AI.**

*If this project helped you or your team, please consider giving it a ⭐*

</div>
