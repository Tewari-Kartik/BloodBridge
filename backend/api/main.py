"""
BloodBridge — FastAPI Backend
==============================
REST API wrapping all 5 ML pipeline stages.

Endpoints:
    POST /api/preprocess  — Clean & detect language
    POST /api/triage      — Classify urgency (P0-P3)
    POST /api/ner         — Extract entities
    POST /api/match       — Find matching donors
    POST /api/forecast    — Predict blood demand
    POST /api/pipeline    — Full end-to-end pipeline
    GET  /api/health      — Health check
    GET  /api/stats       — System statistics

Usage:
    uv run uvicorn backend.api.main:app --reload --port 8000
"""

import sys
import os
import time
from contextlib import asynccontextmanager

# Ensure project root is in path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from backend.api.schemas import (
    MessageRequest, MatchRequest, ForecastRequest, PipelineRequest,
)


# ── Global ML Components (loaded once at startup) ──
class MLModels:
    """Container for all loaded ML models."""
    preprocessor = None
    classifier = None
    ner = None
    matcher = None
    forecaster = None
    startup_time = None
    requests_served = 0


models = MLModels()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load all ML models at startup."""
    start = time.time()
    print("=" * 50)
    print("BloodBridge API — Loading ML Models...")
    print("=" * 50)

    # Stage 1: Preprocessing
    from backend.ml.preprocessing.pipeline import PreprocessingPipeline
    models.preprocessor = PreprocessingPipeline(skip_tokenization=True)
    print("  [1/5] Preprocessing pipeline loaded")

    # Stage 2: Urgency Classifier
    best_model_dir = "backend/models/urgency_classifier/best_model"
    if os.path.exists(best_model_dir):
        from backend.ml.triage.classifier import UrgencyClassifier
        models.classifier = UrgencyClassifier.load(best_model_dir)
        print("  [2/5] Urgency classifier loaded")
    else:
        print("  [2/5] WARNING: No trained classifier found. Using rule-based fallback.")
        from backend.ml.triage.classifier import RuleBasedUrgencyClassifier
        models.classifier = RuleBasedUrgencyClassifier()

    # Stage 3: NER
    from backend.ml.ner.extractor import BloodRequestNER
    models.ner = BloodRequestNER()
    print("  [3/5] NER extractor loaded")

    # Stage 4: Matching
    donor_path = "data/synthetic/donor_registry_50k.csv"
    if os.path.exists(donor_path):
        from backend.ml.matching.engine import DonorMatchingEngine
        models.matcher = DonorMatchingEngine(donor_path)
        print("  [4/5] Matching engine loaded")
    else:
        print("  [4/5] WARNING: No donor registry found")

    # Stage 5: Forecasting
    ts_path = "data/synthetic/blood_demand_timeseries.csv"
    if os.path.exists(ts_path):
        from backend.ml.forecasting.forecaster import DemandForecaster
        models.forecaster = DemandForecaster()
        models.forecaster.load_data(ts_path)
        # Load trained model if available
        model_path = "backend/models/forecasting/xgb_demand.json"
        if os.path.exists(model_path):
            from xgboost import XGBRegressor
            models.forecaster.model = XGBRegressor()
            models.forecaster.model.load_model(model_path)
        print("  [5/5] Demand forecaster loaded")
    else:
        print("  [5/5] WARNING: No time-series data found")

    elapsed = time.time() - start
    models.startup_time = round(elapsed, 2)
    print(f"\nAll models loaded in {elapsed:.1f}s")
    print("=" * 50)

    yield  # App runs here

    print("Shutting down BloodBridge API...")


# ── FastAPI App ──

app = FastAPI(
    title="BloodBridge API",
    description="AI-Powered Emergency Blood Matching System",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health & Stats ──

@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "models_loaded": {
            "preprocessor": models.preprocessor is not None,
            "classifier": models.classifier is not None,
            "ner": models.ner is not None,
            "matcher": models.matcher is not None,
            "forecaster": models.forecaster is not None,
        },
        "startup_time_s": models.startup_time,
    }


@app.get("/api/stats")
async def stats():
    return {
        "requests_served": models.requests_served,
        "donors_loaded": len(models.matcher.donors) if models.matcher else 0,
        "forecaster_records": len(models.forecaster.history) if models.forecaster else 0,
    }


# ── Stage 1: Preprocess ──

@app.post("/api/preprocess")
async def preprocess(req: MessageRequest):
    models.requests_served += 1
    result = models.preprocessor.process(req.message)
    return result


# ── Stage 2: Triage ──

@app.post("/api/triage")
async def triage(req: MessageRequest):
    if models.classifier is None:
        raise HTTPException(503, "Classifier model not loaded")
    models.requests_served += 1
    result = models.classifier.predict(req.message, apply_cleaning=True)
    return result


# ── Stage 3: NER ──

@app.post("/api/ner")
async def ner(req: MessageRequest):
    models.requests_served += 1
    result = models.ner.extract(req.message)
    return result


# ── Stage 4: Match Donors ──

@app.post("/api/match")
async def match(req: MatchRequest):
    if models.matcher is None:
        raise HTTPException(503, "Matching engine not loaded")
    models.requests_served += 1
    result = models.matcher.match(
        blood_group=req.blood_group,
        hospital=req.hospital,
        city=req.city,
        urgency=req.urgency,
        units_needed=req.units_needed,
        top_k=req.top_k,
    )
    return result


# ── Stage 5: Forecast ──

@app.post("/api/forecast")
async def forecast(req: ForecastRequest):
    if models.forecaster is None or models.forecaster.model is None:
        raise HTTPException(503, "Forecaster not loaded or not trained")
    models.requests_served += 1
    predictions = models.forecaster.predict(
        city=req.city,
        blood_group=req.blood_group,
        days_ahead=req.days_ahead,
    )
    return {"predictions": predictions}


# ── Full Pipeline ──

@app.post("/api/pipeline")
async def full_pipeline(req: PipelineRequest):
    """
    Run the complete pipeline on a single message:
    Preprocess → Triage → NER → Match Donors
    """
    models.requests_served += 1
    start = time.time()

    # Step 1: Preprocess
    preprocessed = models.preprocessor.process(req.message)

    # Step 2: Triage
    triage_result = None
    if models.classifier:
        triage_result = models.classifier.predict(req.message, apply_cleaning=True)

    # Step 3: NER
    ner_result = models.ner.extract(req.message)

    # Step 4: Match donors (if blood group found)
    match_result = None
    blood_groups = ner_result['summary'].get('blood_group', [])
    hospitals = ner_result['summary'].get('hospital', [])
    locations = ner_result['summary'].get('location', [])

    if blood_groups and models.matcher:
        match_result = models.matcher.match(
            blood_group=blood_groups[0],
            hospital=hospitals[0] if hospitals else "",
            city=locations[0] if locations else "",
            urgency=triage_result['urgency'] if triage_result else "P1_HIGH",
            units_needed=int(ner_result['summary'].get('units_needed', [2])[0])
                if ner_result['summary'].get('units_needed') else 2,
            top_k=req.top_k_donors,
        )

    elapsed = (time.time() - start) * 1000

    return {
        "message": req.message,
        "preprocessing": {
            "cleaned": preprocessed['cleaned'],
            "language": preprocessed['language'],
        },
        "triage": triage_result,
        "entities": ner_result,
        "matching": match_result,
        "processing_time_ms": round(elapsed, 2),
    }
