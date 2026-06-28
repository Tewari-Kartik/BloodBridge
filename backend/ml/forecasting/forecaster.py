"""
BloodBridge — Blood Demand Forecaster (Stage 5)
=================================================
Predicts future blood demand using XGBoost on time-series features.

Input:  City + Blood Group + Date
Output: Predicted units demanded

Features engineered:
    - day_of_week, month, is_weekend, is_festival
    - lag features (demand 1, 7, 14, 30 days ago)
    - rolling averages (7-day, 14-day, 30-day)
    - city and blood group encodings
"""

import os
import csv
import json
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional

import numpy as np


class DemandForecaster:
    """Predicts blood demand using XGBoost with engineered time-series features."""

    BLOOD_GROUPS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']
    CITIES = ['Delhi', 'Mumbai', 'Bangalore', 'Chennai', 'Kolkata']

    FESTIVAL_DATES = [
        (1, 26), (3, 25), (8, 15), (10, 2),
        (10, 24), (11, 12), (12, 25), (12, 31),
    ]

    def __init__(self):
        self.model = None
        self.history = {}  # (city, blood_group, date_str) -> demand

    def load_data(self, csv_path: str = "data/synthetic/blood_demand_timeseries.csv"):
        """Load historical demand data."""
        self.history = {}
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                key = (row['city'], row['blood_group'], row['date'])
                self.history[key] = int(row['units_demanded'])
        print(f"[Forecast] Loaded {len(self.history)} historical records")

    def _get_demand(self, city: str, bg: str, date: datetime) -> int:
        """Get historical demand for a specific city/bg/date."""
        key = (city, bg, date.strftime('%Y-%m-%d'))
        return self.history.get(key, 0)

    def _is_near_festival(self, date: datetime) -> int:
        for fm, fd in self.FESTIVAL_DATES:
            try:
                fest = datetime(date.year, fm, fd)
                if abs((date - fest).days) <= 2:
                    return 1
            except ValueError:
                pass
        return 0

    def _build_features(self, city: str, bg: str, date: datetime) -> list:
        """Build feature vector for a single prediction point."""
        # Calendar features
        dow = date.weekday()
        month = date.month
        is_weekend = 1 if dow >= 5 else 0
        is_monday = 1 if dow == 0 else 0
        is_festival = self._is_near_festival(date)

        # City encoding (one-hot)
        city_feats = [1 if c == city else 0 for c in self.CITIES]

        # Blood group encoding (one-hot)
        bg_feats = [1 if b == bg else 0 for b in self.BLOOD_GROUPS]

        # Lag features
        lag_1 = self._get_demand(city, bg, date - timedelta(days=1))
        lag_7 = self._get_demand(city, bg, date - timedelta(days=7))
        lag_14 = self._get_demand(city, bg, date - timedelta(days=14))
        lag_30 = self._get_demand(city, bg, date - timedelta(days=30))

        # Rolling averages
        roll_7 = np.mean([self._get_demand(city, bg, date - timedelta(days=d))
                          for d in range(1, 8)])
        roll_14 = np.mean([self._get_demand(city, bg, date - timedelta(days=d))
                           for d in range(1, 15)])
        roll_30 = np.mean([self._get_demand(city, bg, date - timedelta(days=d))
                           for d in range(1, 31)])

        # Same day last week, 2 weeks ago
        same_dow_1w = self._get_demand(city, bg, date - timedelta(days=7))
        same_dow_2w = self._get_demand(city, bg, date - timedelta(days=14))

        return (
            [dow, month, is_weekend, is_monday, is_festival]
            + city_feats + bg_feats
            + [lag_1, lag_7, lag_14, lag_30]
            + [roll_7, roll_14, roll_30]
            + [same_dow_1w, same_dow_2w]
        )

    @property
    def feature_names(self):
        return (
            ['dow', 'month', 'is_weekend', 'is_monday', 'is_festival']
            + [f'city_{c}' for c in self.CITIES]
            + [f'bg_{b}' for b in self.BLOOD_GROUPS]
            + ['lag_1', 'lag_7', 'lag_14', 'lag_30']
            + ['roll_7', 'roll_14', 'roll_30']
            + ['same_dow_1w', 'same_dow_2w']
        )

    def train(self, output_path: str = "backend/models/forecasting/xgb_demand.json"):
        """Train XGBoost demand forecaster."""
        from xgboost import XGBRegressor
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

        print("[Forecast] Building feature matrix...")
        X, y = [], []

        # Use data from day 31 onwards (need 30-day lag)
        all_dates = sorted(set(k[2] for k in self.history.keys()))
        train_dates = all_dates[30:]  # Skip first 30 days

        for date_str in train_dates:
            date = datetime.strptime(date_str, '%Y-%m-%d')
            for city in self.CITIES:
                for bg in self.BLOOD_GROUPS:
                    features = self._build_features(city, bg, date)
                    demand = self._get_demand(city, bg, date)
                    X.append(features)
                    y.append(demand)

        X = np.array(X)
        y = np.array(y)
        print(f"[Forecast] Dataset: {X.shape[0]} samples, {X.shape[1]} features")

        # Chronological split (last 20% for test)
        split_idx = int(len(X) * 0.8)
        X_train, X_test = X[:split_idx], X[split_idx:]
        y_train, y_test = y[:split_idx], y[split_idx:]

        print(f"[Forecast] Train: {len(X_train)}, Test: {len(X_test)}")

        # Train
        model = XGBRegressor(
            n_estimators=200, max_depth=6, learning_rate=0.1,
            subsample=0.8, colsample_bytree=0.8,
            random_state=42, n_jobs=-1,
        )
        model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

        # Evaluate
        y_pred = model.predict(X_test)
        y_pred = np.maximum(y_pred, 0).round()  # Non-negative integer demands

        mae = mean_absolute_error(y_test, y_pred)
        rmse = np.sqrt(mean_squared_error(y_test, y_pred))
        r2 = r2_score(y_test, y_pred)

        print(f"\n[Forecast] Results:")
        print(f"  MAE:  {mae:.3f} units")
        print(f"  RMSE: {rmse:.3f} units")
        print(f"  R2:   {r2:.4f}")

        # Feature importance (top 10)
        importances = model.feature_importances_
        feat_imp = sorted(zip(self.feature_names, importances), key=lambda x: -x[1])
        print(f"\n  Top 10 Features:")
        for name, imp in feat_imp[:10]:
            bar = '#' * int(imp * 50)
            print(f"    {name:15s}: {imp:.3f} {bar}")

        # Save
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        model.save_model(output_path)
        self.model = model
        print(f"\n[Forecast] Model saved to: {output_path}")

        return {'mae': round(mae, 3), 'rmse': round(rmse, 3), 'r2': round(r2, 4)}

    def predict(self, city: str, blood_group: str,
                date: Optional[datetime] = None,
                days_ahead: int = 7) -> list:
        """
        Predict blood demand for upcoming days.

        Args:
            city: City name.
            blood_group: Blood group.
            date: Start date (defaults to latest date in history).
            days_ahead: Number of days to forecast.

        Returns:
            List of dicts with date and predicted demand.
        """
        if self.model is None:
            model_path = "backend/models/forecasting/xgb_demand.json"
            if os.path.exists(model_path):
                from xgboost import XGBRegressor
                self.model = XGBRegressor()
                self.model.load_model(model_path)
            else:
                raise RuntimeError("No trained model found. Run train() first.")

        if date is None:
            latest = max(k[2] for k in self.history.keys())
            date = datetime.strptime(latest, '%Y-%m-%d') + timedelta(days=1)

        predictions = []
        for d in range(days_ahead):
            pred_date = date + timedelta(days=d)
            features = np.array([self._build_features(city, blood_group, pred_date)])
            demand = max(0, round(float(self.model.predict(features)[0])))

            predictions.append({
                'date': pred_date.strftime('%Y-%m-%d'),
                'day': pred_date.strftime('%A'),
                'city': city,
                'blood_group': blood_group,
                'predicted_demand': demand,
            })

            # Add prediction to history for next-day lag features
            key = (city, blood_group, pred_date.strftime('%Y-%m-%d'))
            self.history[key] = demand

        return predictions
