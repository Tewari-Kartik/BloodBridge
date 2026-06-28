# 🩸 BloodBridge — AI-Powered Emergency Blood Matching System

> A 5-stage ML pipeline that processes blood requests in real-time — from urgency triage to optimal donor matching.

![Python](https://img.shields.io/badge/Python-3.12-blue?logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.138-green?logo=fastapi)
![React](https://img.shields.io/badge/React-19-blue?logo=react)
![XGBoost](https://img.shields.io/badge/XGBoost-3.3-orange)
![MuRIL](https://img.shields.io/badge/MuRIL-Transformer-red)
![Docker](https://img.shields.io/badge/Docker-Ready-blue?logo=docker)

---

## 🏗️ Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Stage 1    │     │  Stage 2    │     │  Stage 3    │     │  Stage 4    │
│ Preprocess  │────▶│   Triage    │────▶│    NER      │────▶│  Matching   │
│ Clean/Lang  │     │ MuRIL 96.1% │     │ 7 Entities  │     │ XGBoost 50K │
└─────────────┘     └─────────────┘     └─────────────┘     └──────┬──────┘
                                                                    │
                                         ┌─────────────┐           │
                                         │  Stage 5    │           │
                                         │ Forecasting │◀──────────┘
                                         │ R² = 0.876  │   Supply Planning
                                         └─────────────┘
```

## ✨ Key Metrics

| Stage | Model | Metric | Score |
|-------|-------|--------|-------|
| Urgency Classifier | MuRIL (fine-tuned) | Accuracy | **96.1%** |
| Urgency Classifier | MuRIL (fine-tuned) | P0 Recall | **94.6%** |
| NER | Hybrid Regex+Gazetteer | Blood Group Accuracy | **100%** |
| Donor Matching | XGBoost Ranker | Donors Indexed | **50,000** |
| Demand Forecast | XGBoost Regressor | R² Score | **0.876** |
| Full Pipeline | End-to-End | Latency | **~1.08s** |

---

## 🚀 Quick Start

### Prerequisites
- Python 3.12+
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- Node.js 18+ (for frontend)

### 1. Clone & Install

```bash
git clone https://github.com/<your-username>/bloodbridge.git
cd bloodbridge

# Backend
uv sync

# Frontend
cd frontend && npm install && cd ..
```

### 2. Generate Data & Train Models

```bash
# Generate synthetic datasets
uv run python data/synthetic/generate_messages.py
uv run python data/synthetic/generate_donors.py
uv run python data/synthetic/generate_timeseries.py

# Train urgency classifier (requires ~5 hours on CPU, ~30 min on GPU)
uv run python backend/ml/triage/train.py

# Train matching & forecasting models (fast — seconds)
uv run python backend/ml/matching/run_matching.py
uv run python backend/ml/forecasting/run_forecast.py
```

### 3. Run

```bash
# Start backend (port 8000)
uv run uvicorn backend.api.main:app --port 8000

# Start frontend (port 5173) — in another terminal
cd frontend && npm run dev
```

Open **http://localhost:5173** 🎉

### Docker (One Command)

```bash
docker compose up --build
# Frontend → http://localhost:3000
# Backend  → http://localhost:8000
```

---

## 🔗 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check + model status |
| `GET` | `/api/stats` | System statistics |
| `POST` | `/api/preprocess` | Clean & detect language |
| `POST` | `/api/triage` | Classify urgency (P0–P3) |
| `POST` | `/api/ner` | Extract entities |
| `POST` | `/api/match` | Find matching donors |
| `POST` | `/api/forecast` | Predict blood demand |
| `POST` | `/api/pipeline` | **Full end-to-end pipeline** |

Interactive docs: **http://localhost:8000/docs**

---

## 📁 Project Structure

```
bloodbridge/
├── backend/
│   ├── api/                    # FastAPI endpoints
│   │   ├── main.py             # App entry point + model loading
│   │   └── schemas.py          # Pydantic request/response models
│   ├── ml/
│   │   ├── preprocessing/      # Stage 1: cleaner, language detection
│   │   ├── triage/             # Stage 2: MuRIL urgency classifier
│   │   ├── ner/                # Stage 3: entity extraction
│   │   ├── matching/           # Stage 4: donor ranking engine
│   │   └── forecasting/        # Stage 5: demand prediction
│   └── models/                 # Saved model weights
├── data/
│   ├── synthetic/              # Generated datasets
│   └── processed/              # Cleaned + split data
├── frontend/                   # React dashboard (Vite)
├── docker/                     # Dockerfiles + nginx config
├── docker-compose.yml          # One-command deployment
└── pyproject.toml              # Python dependencies
```

---

## 🧠 ML Pipeline Details

### Stage 1 — Preprocessing
Text cleaning, phone masking, blood group extraction via regex, language detection (Hindi/English/Hinglish).

### Stage 2 — Urgency Classification
Fine-tuned [MuRIL](https://huggingface.co/google/muril-base-cased) (Google's multilingual model for Indian languages) on 1,507 synthetic blood requests. 4-class classification with weighted cross-entropy for class imbalance handling.

### Stage 3 — Named Entity Recognition
Hybrid approach: regex patterns for structured entities (blood groups, phone numbers, units) + gazetteers for hospitals/cities + keyword matching for medical conditions. Extracts 7 entity types.

### Stage 4 — Donor Matching
XGBoost ranker scoring 50K donors on 7 features: haversine distance, blood compatibility (full medical rules), response history, donation recency, and blood group rarity.

### Stage 5 — Demand Forecasting
XGBoost regressor with 27 engineered features: calendar (day/month/weekend/festival), lag features (1/7/14/30 day), rolling averages, city + blood group encodings. Auto-regressive multi-step prediction.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| ML / NLP | PyTorch, HuggingFace Transformers, MuRIL |
| Ranking & Forecasting | XGBoost, scikit-learn |
| Backend | FastAPI, Uvicorn |
| Frontend | React 19, Vite |
| Deployment | Docker, nginx |
| Package Manager | uv (Python), npm (Node) |

---

## 📄 License

MIT

---

<p align="center">
  Built with ❤️ for saving lives through AI
</p>
