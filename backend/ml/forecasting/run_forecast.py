"""Train forecaster and show 7-day predictions."""
import sys, os, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.path.insert(0, os.getcwd())

from backend.ml.forecasting.forecaster import DemandForecaster

forecaster = DemandForecaster()
forecaster.load_data()

print("\n--- Training Demand Forecaster ---")
metrics = forecaster.train()

print("\n" + "=" * 60)
print("7-DAY DEMAND FORECASTS")
print("=" * 60)

test_cases = [
    ("Delhi", "O+"),
    ("Mumbai", "AB-"),
    ("Chennai", "B+"),
]

for city, bg in test_cases:
    preds = forecaster.predict(city, bg, days_ahead=7)
    print(f"\n--- {city} | {bg} ---")
    for p in preds:
        bar = '#' * p['predicted_demand']
        print(f"  {p['date']} ({p['day'][:3]}) : {p['predicted_demand']:3d} units  {bar}")

print("\n\nStage 5 Demand Forecasting: DONE")
print("ALL 5 STAGES COMPLETE!")
