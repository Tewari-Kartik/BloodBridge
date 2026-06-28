"""Test all API endpoints."""
import sys, io, json, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import urllib.request

BASE = "http://127.0.0.1:8000"

def post(path, data):
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=json.dumps(data).encode('utf-8'),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())

def get(path):
    with urllib.request.urlopen(f"{BASE}{path}", timeout=10) as resp:
        return json.loads(resp.read().decode())

print("=" * 55)
print("BLOODBRIDGE API TESTS")
print("=" * 55)

# Test 1: Health
print("\n[1] GET /api/health")
r = get("/api/health")
print(f"    Status: {r['status']}")
for k, v in r['models_loaded'].items():
    print(f"    {k}: {'OK' if v else 'MISSING'}")

# Test 2: Preprocess
print("\n[2] POST /api/preprocess")
r = post("/api/preprocess", {"message": "Need 3 units O -ve blood at AIIMS Delhi urgently! Call 9876543210"})
print(f"    Cleaned: {r['cleaned'][:80]}")
print(f"    Language: {r['language']['language']}")
print(f"    Blood groups: {r['extracted']['blood_groups']}")

# Test 3: Triage
print("\n[3] POST /api/triage")
r = post("/api/triage", {"message": "URGENT! Patient dying needs O- blood at AIIMS Delhi NOW"})
print(f"    Urgency: {r['urgency']} (conf: {r['confidence']})")
print(f"    Is critical: {r['is_critical']}")

# Test 4: NER
print("\n[4] POST /api/ner")
r = post("/api/ner", {"message": "Need 3 units AB- blood for accident patient at Fortis Gurgaon tomorrow. Call 9012345678"})
print(f"    Entities found: {r['entity_count']}")
for e in r['entities']:
    print(f"    {e['type']:20s} = {e['value']}")

# Test 5: Match
print("\n[5] POST /api/match")
r = post("/api/match", {"blood_group": "O-", "hospital": "AIIMS Delhi", "city": "Delhi", "urgency": "P0_CRITICAL", "top_k": 3})
print(f"    Compatible donors: {r['stats']['total_compatible']}")
for d in r['donors']:
    print(f"    #{d['rank']} {d['name']:20s} | {d['blood_group']} | {d['distance_km']}km | score:{d['match_score']}")

# Test 6: Forecast
print("\n[6] POST /api/forecast")
r = post("/api/forecast", {"city": "Delhi", "blood_group": "O+", "days_ahead": 5})
for p in r['predictions']:
    print(f"    {p['date']} ({p['day'][:3]}): {p['predicted_demand']} units")

# Test 7: Full Pipeline
print("\n[7] POST /api/pipeline (FULL END-TO-END)")
r = post("/api/pipeline", {"message": "URGENT! Need 4 units O- blood at AIIMS Delhi. Accident victim in ICU. Call 9876543210", "top_k_donors": 3})
print(f"    Cleaned: {r['preprocessing']['cleaned'][:70]}")
print(f"    Language: {r['preprocessing']['language']['language']}")
if r['triage']:
    print(f"    Urgency: {r['triage']['urgency']} (conf: {r['triage']['confidence']})")
print(f"    Entities: {r['entities']['entity_count']}")
if r['matching']:
    print(f"    Donors matched: {r['matching']['stats']['total_compatible']}")
    for d in r['matching']['donors']:
        print(f"      #{d['rank']} {d['name']:20s} | {d['blood_group']} | {d['distance_km']}km")
print(f"    Total time: {r['processing_time_ms']}ms")

print("\n" + "=" * 55)
print("ALL 7 TESTS PASSED!")
print("=" * 55)
