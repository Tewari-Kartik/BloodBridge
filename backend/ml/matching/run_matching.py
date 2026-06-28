"""Train XGBoost ranker and test donor matching."""
import sys, os, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.path.insert(0, os.getcwd())

from backend.ml.matching.engine import DonorMatchingEngine

# Load donors and train XGBoost
engine = DonorMatchingEngine()
print("\n--- Training XGBoost Ranker ---")
result = engine.train_ranker()

# Test matching
print("\n" + "=" * 60)
print("MATCHING TESTS")
print("=" * 60)

tests = [
    {"blood_group": "O-", "hospital": "AIIMS Delhi", "city": "Delhi",
     "urgency": "P0_CRITICAL", "units_needed": 4},
    {"blood_group": "AB-", "hospital": "KEM Hospital Mumbai", "city": "Mumbai",
     "urgency": "P0_CRITICAL", "units_needed": 2},
    {"blood_group": "B+", "hospital": "Fortis Hospital Gurgaon", "city": "Gurgaon",
     "urgency": "P1_HIGH", "units_needed": 3},
    {"blood_group": "A+", "hospital": "Apollo Hospital Chennai", "city": "Chennai",
     "urgency": "P2_MODERATE", "units_needed": 2},
]

for i, req in enumerate(tests, 1):
    result = engine.match(**req, top_k=5)
    print(f"\n--- Request {i}: {req['blood_group']} at {req['hospital']} ({req['urgency']}) ---")
    print(f"  Compatible donors: {result['stats']['total_compatible']}")
    print(f"  Exact match available: {result['stats']['exact_match_available']}")
    print(f"  Compatible groups: {result['stats']['compatible_groups']}")
    print(f"  Top 5 donors:")
    for d in result['donors']:
        print(f"    #{d['rank']} {d['name']:20s} | {d['blood_group']:3s} | "
              f"{d['distance_km']:5.1f}km | resp:{d['response_rate']:.2f} | "
              f"score:{d['match_score']:.4f}")

print("\n\nStage 4 Donor Matching: DONE")
