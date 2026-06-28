"""
BloodBridge — Donor Matching Engine (Stage 4)
===============================================
Ranks and selects optimal blood donors for a given request.

Pipeline:
    1. Filter by blood group compatibility
    2. Filter by eligibility (>90 days since last donation, is_active)
    3. Compute feature vector per donor
    4. Score using XGBoost ranker (or weighted heuristic as fallback)
    5. Return top-K ranked donors

Features used for ranking:
    - distance_km: Haversine distance from donor to hospital
    - is_exact_match: 1 if blood group matches exactly, 0 if just compatible
    - response_rate: Historical response rate (0-1)
    - days_since_donation: Days since last donation
    - total_donations: Lifetime donation count
    - avg_response_minutes: Avg time to respond to requests
    - blood_rarity: How rare the needed blood group is (0-1)
"""

import os
import csv
import math
import json
from typing import Optional

from backend.ml.matching.compatibility import (
    is_compatible, is_eligible, is_exact_match,
    get_compatible_donors, RARITY, MIN_DONATION_GAP_DAYS,
)


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two lat/lon points in kilometers."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# Approximate hospital coordinates for distance calculation
HOSPITAL_COORDS = {
    "AIIMS Delhi": (28.5672, 77.2100),
    "Safdarjung Hospital Delhi": (28.5685, 77.2066),
    "Sir Ganga Ram Hospital Delhi": (28.6380, 77.1880),
    "Max Hospital Saket Delhi": (28.5275, 77.2137),
    "Max Hospital Delhi": (28.5275, 77.2137),
    "Fortis Hospital Gurgaon": (28.4440, 77.0400),
    "Medanta Gurgaon": (28.4395, 77.0420),
    "KEM Hospital Mumbai": (19.0000, 72.8420),
    "Lilavati Hospital Mumbai": (19.0510, 72.8290),
    "Kokilaben Hospital Mumbai": (19.1310, 72.8270),
    "Breach Candy Hospital Mumbai": (18.9710, 72.8050),
    "Tata Memorial Hospital Mumbai": (19.0048, 72.8435),
    "Apollo Hospital Chennai": (13.0067, 80.2206),
    "Rajiv Gandhi Hospital Chennai": (13.0560, 80.2380),
    "CMC Vellore": (12.9237, 79.1350),
    "Narayana Health Bangalore": (12.8910, 77.5970),
    "Manipal Hospital Bangalore": (12.9590, 77.6480),
    "KIMS Hyderabad": (17.4110, 78.4420),
    "PGIMER Chandigarh": (30.7640, 76.7760),
    "Ruby Hall Clinic Pune": (18.5330, 73.8860),
    "Amrita Hospital Kochi": (10.0650, 76.3460),
    "JIPMER Pondicherry": (11.9600, 79.8550),
}

# City center coordinates (fallback when hospital not in dict)
CITY_COORDS = {
    "Delhi": (28.6139, 77.2090), "Mumbai": (19.0760, 72.8777),
    "Bangalore": (12.9716, 77.5946), "Chennai": (13.0827, 80.2707),
    "Kolkata": (22.5726, 88.3639), "Hyderabad": (17.3850, 78.4867),
    "Pune": (18.5204, 73.8567), "Jaipur": (26.9124, 75.7873),
    "Lucknow": (26.8467, 80.9462), "Chandigarh": (30.7333, 76.7794),
    "Gurgaon": (28.4595, 77.0266), "Kochi": (9.9312, 76.2673),
    "Vellore": (12.9165, 79.1325),
}


class DonorMatchingEngine:
    """
    Ranks blood donors for a given request using ML-based scoring.
    """

    def __init__(self, donor_csv_path: str = "data/synthetic/donor_registry_50k.csv"):
        """Load donor registry from CSV."""
        self.donors = []
        self.model = None
        self._load_donors(donor_csv_path)
        self._try_load_model()

    def _load_donors(self, csv_path: str):
        """Load donor data from CSV file."""
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                self.donors.append({
                    'donor_id': row['donor_id'],
                    'name': row['name'],
                    'blood_group': row['blood_group'],
                    'city': row['city'],
                    'latitude': float(row['latitude']),
                    'longitude': float(row['longitude']),
                    'last_donation_days_ago': int(row['last_donation_days_ago']),
                    'total_donations': int(row['total_donations']),
                    'response_rate': float(row['response_rate']),
                    'avg_response_minutes': int(row['avg_response_minutes']),
                    'phone': row['phone'],
                    'is_active': row['is_active'] == 'True',
                })
        print(f"[Matching] Loaded {len(self.donors)} donors")

    def _try_load_model(self):
        """Try to load trained XGBoost model, fall back to heuristic scoring."""
        model_path = "backend/models/matching/xgb_ranker.json"
        if os.path.exists(model_path):
            try:
                import xgboost as xgb
                self.model = xgb.XGBClassifier()
                self.model.load_model(model_path)
                print("[Matching] Loaded XGBoost ranker model")
            except Exception:
                self.model = None
        if self.model is None:
            print("[Matching] Using weighted heuristic scoring (no trained model)")

    def match(self, blood_group: str, hospital: str = "",
              city: str = "", urgency: str = "P1_HIGH",
              units_needed: int = 2, top_k: int = 10) -> dict:
        """
        Find and rank best donors for a blood request.

        Args:
            blood_group: Required blood group (e.g., "O-", "AB+").
            hospital: Hospital name (for distance calculation).
            city: City name (fallback for distance).
            urgency: Urgency level from Stage 2.
            units_needed: Number of units needed.
            top_k: Number of top donors to return.

        Returns:
            Dict with ranked donors and match statistics.
        """
        # Get request location
        req_lat, req_lon = self._get_location(hospital, city)

        # Step 1: Filter compatible + eligible donors
        compatible_bgs = get_compatible_donors(blood_group)
        candidates = [
            d for d in self.donors
            if d['blood_group'] in compatible_bgs
            and d['is_active']
            and is_eligible(d['last_donation_days_ago'])
        ]

        if not candidates:
            return {
                'donors': [], 'total_compatible': 0,
                'total_eligible': 0, 'message': 'No eligible donors found',
            }

        # Step 2: Compute features and score each candidate
        scored = []
        for donor in candidates:
            features = self._compute_features(
                donor, blood_group, req_lat, req_lon, urgency
            )
            score = self._score(features)
            scored.append({
                'donor': donor,
                'features': features,
                'score': round(score, 4),
            })

        # Step 3: Sort by score (descending) and take top-K
        scored.sort(key=lambda x: -x['score'])
        top = scored[:top_k]

        # Step 4: Build response
        ranked_donors = []
        for rank, entry in enumerate(top, 1):
            d = entry['donor']
            f = entry['features']
            ranked_donors.append({
                'rank': rank,
                'donor_id': d['donor_id'],
                'name': d['name'],
                'blood_group': d['blood_group'],
                'city': d['city'],
                'phone': d['phone'],
                'distance_km': round(f['distance_km'], 1),
                'is_exact_match': f['is_exact_match'],
                'response_rate': d['response_rate'],
                'total_donations': d['total_donations'],
                'days_since_donation': d['last_donation_days_ago'],
                'match_score': entry['score'],
            })

        # Stats
        exact_count = sum(1 for c in candidates if c['blood_group'] == blood_group)

        return {
            'request': {
                'blood_group': blood_group,
                'hospital': hospital,
                'city': city,
                'urgency': urgency,
                'units_needed': units_needed,
            },
            'donors': ranked_donors,
            'stats': {
                'total_compatible': len(candidates),
                'exact_match_available': exact_count,
                'compatible_groups': list(compatible_bgs),
                'search_radius_km': round(top[-1]['features']['distance_km'], 1) if top else 0,
            },
        }

    def _compute_features(self, donor: dict, needed_bg: str,
                          req_lat: float, req_lon: float,
                          urgency: str) -> dict:
        """Compute feature vector for a donor-request pair."""
        distance = haversine_km(
            donor['latitude'], donor['longitude'], req_lat, req_lon
        )

        return {
            'distance_km': distance,
            'distance_score': max(0, 1.0 - (distance / 100.0)),  # 0-1, 100km=0
            'is_exact_match': 1.0 if is_exact_match(donor['blood_group'], needed_bg) else 0.0,
            'response_rate': donor['response_rate'],
            'days_since_donation': donor['last_donation_days_ago'],
            'donation_recency_score': min(donor['last_donation_days_ago'] / 365.0, 1.0),
            'total_donations': donor['total_donations'],
            'experience_score': min(donor['total_donations'] / 10.0, 1.0),
            'response_speed_score': max(0, 1.0 - (donor['avg_response_minutes'] / 120.0)),
            'blood_rarity': RARITY.get(needed_bg, 0.5),
            'urgency_weight': {'P0_CRITICAL': 1.5, 'P1_HIGH': 1.2,
                               'P2_MODERATE': 1.0, 'P3_INFO': 0.8}.get(urgency, 1.0),
        }

    def _score(self, features: dict) -> float:
        """Score a donor using XGBoost model or weighted heuristic."""
        if self.model is not None:
            import numpy as np
            X = np.array([[
                features['distance_score'], features['is_exact_match'],
                features['response_rate'], features['donation_recency_score'],
                features['experience_score'], features['response_speed_score'],
                features['blood_rarity'],
            ]])
            return float(self.model.predict_proba(X)[0][1])

        # Weighted heuristic fallback
        w = features['urgency_weight']
        score = (
            0.30 * features['distance_score'] * w +
            0.15 * features['is_exact_match'] +
            0.20 * features['response_rate'] +
            0.10 * features['donation_recency_score'] +
            0.10 * features['experience_score'] +
            0.15 * features['response_speed_score']
        )
        return score

    def _get_location(self, hospital: str, city: str) -> tuple:
        """Get lat/lon for request location."""
        if hospital:
            for name, coords in HOSPITAL_COORDS.items():
                if name.lower() in hospital.lower() or hospital.lower() in name.lower():
                    return coords
        if city:
            for name, coords in CITY_COORDS.items():
                if name.lower() == city.lower():
                    return coords
        return (28.6139, 77.2090)  # Default: Delhi

    def train_ranker(self, output_path: str = "backend/models/matching/xgb_ranker.json"):
        """
        Train XGBoost ranker on synthetic preference data.
        Generates training pairs from donor registry and trains a model.
        """
        import numpy as np
        from xgboost import XGBClassifier
        from sklearn.model_selection import train_test_split

        print("[Matching] Generating training data...")
        X, y = [], []
        import random
        random.seed(42)

        blood_groups = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']

        for _ in range(20000):
            needed_bg = random.choice(blood_groups)
            city = random.choice(list(CITY_COORDS.keys()))
            req_lat, req_lon = CITY_COORDS[city]
            urgency = random.choice(['P0_CRITICAL', 'P1_HIGH', 'P2_MODERATE', 'P3_INFO'])

            donor = random.choice(self.donors)
            compatible = is_compatible(donor['blood_group'], needed_bg)
            eligible = is_eligible(donor['last_donation_days_ago'])

            if not (compatible and eligible and donor['is_active']):
                continue

            features = self._compute_features(donor, needed_bg, req_lat, req_lon, urgency)

            # Generate label: would this donor respond? (simulated)
            respond_prob = (
                0.3 * features['distance_score'] +
                0.25 * features['response_rate'] +
                0.15 * features['is_exact_match'] +
                0.15 * features['donation_recency_score'] +
                0.15 * features['response_speed_score']
            )
            responded = 1 if random.random() < respond_prob else 0

            X.append([
                features['distance_score'], features['is_exact_match'],
                features['response_rate'], features['donation_recency_score'],
                features['experience_score'], features['response_speed_score'],
                features['blood_rarity'],
            ])
            y.append(responded)

        X = np.array(X)
        y = np.array(y)
        print(f"[Matching] Training data: {len(X)} samples, positive rate: {y.mean():.2f}")

        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

        model = XGBClassifier(
            n_estimators=100, max_depth=5, learning_rate=0.1,
            random_state=42, eval_metric='logloss',
        )
        model.fit(X_train, y_train)

        # Evaluate
        from sklearn.metrics import accuracy_score, f1_score, roc_auc_score
        y_pred = model.predict(X_test)
        y_proba = model.predict_proba(X_test)[:, 1]

        acc = accuracy_score(y_test, y_pred)
        f1 = f1_score(y_test, y_pred)
        auc = roc_auc_score(y_test, y_proba)

        print(f"[Matching] XGBoost Results:")
        print(f"  Accuracy: {acc:.4f}")
        print(f"  F1 Score: {f1:.4f}")
        print(f"  ROC AUC:  {auc:.4f}")

        # Feature importance
        feat_names = ['distance', 'exact_match', 'response_rate',
                      'recency', 'experience', 'speed', 'rarity']
        importances = model.feature_importances_
        print(f"\n  Feature Importance:")
        for name, imp in sorted(zip(feat_names, importances), key=lambda x: -x[1]):
            bar = '#' * int(imp * 40)
            print(f"    {name:15s}: {imp:.3f} {bar}")

        # Save
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        model.save_model(output_path)
        self.model = model
        print(f"\n[Matching] Model saved to: {output_path}")

        return {'accuracy': acc, 'f1': f1, 'auc': auc}
