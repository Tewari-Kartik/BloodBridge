"""
BloodBridge — Master Data Pipeline
===================================
1. Merge all 30 batch JSON files into one clean dataset
2. Generate 50K synthetic donor registry
3. Generate 2-year blood demand time-series
"""
import json
import os
import random
import csv
from collections import Counter
from datetime import datetime, timedelta

BASE_DIR = r"C:\Users\Kartik Tewari\.gemini\antigravity\scratch\bloodbridge"
RAW_DIR = os.path.join(BASE_DIR, "data", "raw")
PROCESSED_DIR = os.path.join(BASE_DIR, "data", "processed")
SYNTHETIC_DIR = os.path.join(BASE_DIR, "data", "synthetic")

os.makedirs(PROCESSED_DIR, exist_ok=True)
os.makedirs(SYNTHETIC_DIR, exist_ok=True)

# ================================================================
# STEP 1: MERGE ALL BATCH FILES
# ================================================================
print("=" * 60)
print("STEP 1: MERGING 30 BATCH FILES")
print("=" * 60)

all_messages = []
batch_files = sorted([f for f in os.listdir(RAW_DIR) if f.startswith("batch_") and f.endswith(".json")])

for fname in batch_files:
    fpath = os.path.join(RAW_DIR, fname)
    with open(fpath, "r", encoding="utf-8") as f:
        batch = json.load(f)
    print(f"  {fname}: {len(batch)} messages")
    all_messages.extend(batch)

print(f"\nTotal messages (before dedup): {len(all_messages)}")

# Deduplicate by message text
seen = set()
unique_messages = []
dupes = 0
for msg in all_messages:
    text = msg["message"].strip()
    if text not in seen:
        seen.add(text)
        unique_messages.append(msg)
    else:
        dupes += 1

print(f"Duplicates removed: {dupes}")
print(f"Total unique messages: {len(unique_messages)}")

# Analyze
print("\n--- Urgency Distribution ---")
urgency_counts = Counter(m.get("urgency", "UNKNOWN") for m in unique_messages)
for urg, count in sorted(urgency_counts.items()):
    pct = count / len(unique_messages) * 100
    bar = "#" * int(pct / 2)
    print(f"  {urg:15s} : {count:4d} ({pct:5.1f}%) {bar}")

print("\n--- Blood Group Distribution ---")
bg_counts = Counter(m.get("blood_group", "UNKNOWN") for m in unique_messages)
for bg, count in sorted(bg_counts.items(), key=lambda x: -x[1]):
    pct = count / len(unique_messages) * 100
    print(f"  {bg:8s} : {count:4d} ({pct:5.1f}%)")

print("\n--- Language Distribution ---")
lang_counts = Counter(m.get("language", "UNKNOWN") for m in unique_messages)
for lang, count in sorted(lang_counts.items(), key=lambda x: -x[1]):
    pct = count / len(unique_messages) * 100
    print(f"  {lang:12s} : {count:4d} ({pct:5.1f}%)")

print("\n--- Top 10 Cities ---")
city_counts = Counter(m.get("city", "UNKNOWN") for m in unique_messages)
for city, count in city_counts.most_common(10):
    print(f"  {city:20s} : {count:4d}")

# Check required fields
print("\n--- Field Completeness ---")
required_fields = ["message", "urgency", "blood_group", "hospital", "city", "units_needed", "patient_condition"]
for field in required_fields:
    missing = sum(1 for m in unique_messages if field not in m or m[field] is None)
    status = "OK" if missing == 0 else f"MISSING {missing}"
    print(f"  {field:20s} : {status}")

# Save merged dataset
out_path = os.path.join(PROCESSED_DIR, "all_messages.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(unique_messages, f, ensure_ascii=False, indent=2)
print(f"\n>> Saved {len(unique_messages)} messages -> data/processed/all_messages.json")


# ================================================================
# STEP 2: GENERATE 50K SYNTHETIC DONOR REGISTRY
# ================================================================
print("\n" + "=" * 60)
print("STEP 2: GENERATING 50K DONOR REGISTRY")
print("=" * 60)

random.seed(42)

BLOOD_DIST = {
    'O+': 0.366, 'B+': 0.308, 'A+': 0.221, 'AB+': 0.061,
    'O-': 0.023, 'B-': 0.012, 'A-': 0.006, 'AB-': 0.003
}
BLOOD_TYPES = list(BLOOD_DIST.keys())
BLOOD_PROBS = list(BLOOD_DIST.values())

CITIES = {
    'Delhi':     (28.50, 28.80, 76.90, 77.30),
    'Mumbai':    (18.90, 19.30, 72.80, 73.00),
    'Bangalore': (12.80, 13.10, 77.50, 77.70),
    'Chennai':   (12.90, 13.20, 80.10, 80.30),
    'Kolkata':   (22.40, 22.70, 88.30, 88.50),
    'Hyderabad': (17.30, 17.50, 78.40, 78.60),
    'Pune':      (18.40, 18.60, 73.80, 74.00),
    'Jaipur':    (26.80, 27.00, 75.70, 75.90),
    'Lucknow':   (26.80, 26.95, 80.90, 81.05),
    'Chandigarh':(30.70, 30.78, 76.74, 76.82),
}
CITY_NAMES = list(CITIES.keys())
CITY_PROBS = [0.20, 0.18, 0.14, 0.10, 0.08, 0.08, 0.07, 0.05, 0.05, 0.05]

FIRST_NAMES_M = [
    "Aarav", "Vivaan", "Aditya", "Arjun", "Sai", "Reyansh", "Ayaan", "Krishna",
    "Ishaan", "Shaurya", "Rohan", "Rahul", "Vikram", "Amit", "Suresh", "Raj",
    "Karan", "Nikhil", "Mohit", "Deepak", "Ankur", "Gaurav", "Harsh", "Manish",
    "Pradeep", "Rajesh", "Sanjay", "Vijay", "Ajay", "Manoj", "Ravi", "Sachin",
    "Akash", "Ankit", "Dhruv", "Kunal", "Pranav", "Tushar", "Varun", "Yash",
    "Abhinav", "Vishal", "Naveen", "Sandeep", "Ashish", "Kapil", "Siddharth", "Aryan"
]
FIRST_NAMES_F = [
    "Aanya", "Ananya", "Diya", "Isha", "Kavya", "Myra", "Priya", "Riya",
    "Saanvi", "Shreya", "Aditi", "Nisha", "Pooja", "Neha", "Swati", "Anjali",
    "Sunita", "Rekha", "Meena", "Geeta", "Kavitha", "Lakshmi", "Sneha", "Pallavi",
    "Divya", "Aishwarya", "Bhavna", "Chitra", "Jyoti", "Komal", "Mansi", "Nandini",
    "Payal", "Rashmi", "Sakshi", "Tanvi", "Urmi", "Vidya", "Yamini", "Zara"
]
LAST_NAMES = [
    "Sharma", "Verma", "Gupta", "Singh", "Kumar", "Patel", "Reddy", "Nair",
    "Iyer", "Mukherjee", "Chatterjee", "Banerjee", "Das", "Mishra", "Pandey",
    "Joshi", "Mehta", "Shah", "Desai", "Kulkarni", "Rao", "Menon", "Pillai",
    "Tiwari", "Yadav", "Jain", "Agarwal", "Chauhan", "Thakur", "Malhotra",
    "Khanna", "Kapoor", "Bhatia", "Saxena", "Srivastava", "Dubey", "Shukla",
    "Patil", "Deshpande", "Naidu", "Chowdhury", "Bhatt", "Rathore", "Sethi"
]

def random_phone():
    prefix = random.choice(["98", "97", "96", "95", "88", "87", "86", "70", "73", "74"])
    return prefix + "".join([str(random.randint(0, 9)) for _ in range(8)])

def random_exponential(mean):
    return int(random.expovariate(1.0 / mean))

def random_beta(a, b):
    return min(max(random.betavariate(a, b), 0.0), 1.0)

donors = []
for i in range(50000):
    gender = random.choices(["M", "F"], weights=[0.65, 0.35])[0]
    first = random.choice(FIRST_NAMES_M if gender == "M" else FIRST_NAMES_F)
    last = random.choice(LAST_NAMES)

    city = random.choices(CITY_NAMES, weights=CITY_PROBS)[0]
    lat_min, lat_max, lon_min, lon_max = CITIES[city]

    blood_group = random.choices(BLOOD_TYPES, weights=BLOOD_PROBS)[0]
    age = random.randint(18, 59)
    last_donation_days = random_exponential(180)
    total_donations = max(0, int(random.gauss(3, 2)))
    response_rate = round(random_beta(5, 2), 3)
    avg_response_min = random_exponential(45)

    donors.append({
        "donor_id": f"D{i:05d}",
        "name": f"{first} {last}",
        "age": age,
        "gender": gender,
        "blood_group": blood_group,
        "city": city,
        "latitude": round(random.uniform(lat_min, lat_max), 6),
        "longitude": round(random.uniform(lon_min, lon_max), 6),
        "last_donation_days_ago": last_donation_days,
        "total_donations": total_donations,
        "response_rate": response_rate,
        "avg_response_minutes": avg_response_min,
        "phone": random_phone(),
        "is_active": random.choices([True, False], weights=[0.7, 0.3])[0],
    })

# Save as CSV
donor_path = os.path.join(SYNTHETIC_DIR, "donor_registry_50k.csv")
fieldnames = list(donors[0].keys())
with open(donor_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(donors)

print(f"Generated {len(donors)} donors")
bg_dist = Counter(d["blood_group"] for d in donors)
print("\nBlood Group Distribution:")
for bg in ["O+", "B+", "A+", "AB+", "O-", "B-", "A-", "AB-"]:
    count = bg_dist[bg]
    pct = count / len(donors) * 100
    print(f"  {bg:5s} : {count:5d} ({pct:5.1f}%)")

city_dist = Counter(d["city"] for d in donors)
print("\nCity Distribution:")
for city, count in city_dist.most_common():
    print(f"  {city:12s} : {count:5d}")

eligible = sum(1 for d in donors if d["last_donation_days_ago"] > 90)
active = sum(1 for d in donors if d["is_active"])
print(f"\nEligible to donate (>90 days): {eligible} ({eligible/len(donors)*100:.1f}%)")
print(f"Active donors: {active} ({active/len(donors)*100:.1f}%)")
print(f"\n>> Saved -> data/synthetic/donor_registry_50k.csv")


# ================================================================
# STEP 3: GENERATE BLOOD DEMAND TIME-SERIES
# ================================================================
print("\n" + "=" * 60)
print("STEP 3: GENERATING BLOOD DEMAND TIME-SERIES (2 YEARS)")
print("=" * 60)

random.seed(42)

start_date = datetime(2023, 1, 1)
end_date = datetime(2024, 12, 31)
num_days = (end_date - start_date).days + 1

cities_ts = ["Delhi", "Mumbai", "Bangalore", "Chennai", "Kolkata"]
blood_groups_ts = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"]

BASE_DEMAND = {
    "O+": 15, "B+": 12, "A+": 9, "AB+": 3,
    "O-": 2,  "B-": 1,  "A-": 1, "AB-": 0.5
}

FESTIVAL_DATES = [
    (1, 26), (3, 25), (8, 15), (10, 2),
    (10, 24), (11, 12), (12, 25), (12, 31),
]

def is_near_festival(date):
    for fm, fd in FESTIVAL_DATES:
        fest = datetime(date.year, fm, fd)
        if abs((date - fest).days) <= 2:
            return True
    return False

def poisson_sample(lam):
    import math
    L = math.exp(-max(lam, 0.01))
    k = 0
    p = 1.0
    while p > L:
        k += 1
        p *= random.random()
    return k - 1

rows = []
for day_offset in range(num_days):
    date = start_date + timedelta(days=day_offset)
    day_of_week = date.weekday()
    month = date.month

    for city in cities_ts:
        city_mult = {"Delhi": 1.3, "Mumbai": 1.4, "Bangalore": 1.1, "Chennai": 1.0, "Kolkata": 0.9}[city]

        for bg in blood_groups_ts:
            base = BASE_DEMAND[bg]

            if month in [4, 5, 6]:
                seasonal = 1.25
            elif month in [10, 11]:
                seasonal = 1.3
            elif month in [7, 8]:
                seasonal = 1.15
            else:
                seasonal = 1.0

            weekend = 0.65 if day_of_week >= 5 else 1.0
            monday = 1.2 if day_of_week == 0 else 1.0
            festival = 1.5 if is_near_festival(date) else 1.0

            lam = max(0.1, base * city_mult * seasonal * weekend * monday * festival)
            demand = poisson_sample(lam)

            rows.append({
                "date": date.strftime("%Y-%m-%d"),
                "city": city,
                "blood_group": bg,
                "units_demanded": demand,
                "day_of_week": day_of_week,
                "month": month,
                "is_weekend": int(day_of_week >= 5),
                "is_festival": int(is_near_festival(date)),
            })

ts_path = os.path.join(SYNTHETIC_DIR, "blood_demand_timeseries.csv")
fieldnames_ts = list(rows[0].keys())
with open(ts_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames_ts)
    writer.writeheader()
    writer.writerows(rows)

print(f"Generated {len(rows)} rows")
print(f"Date range: {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}")
print(f"Cities: {', '.join(cities_ts)}")
print(f"Blood groups: {', '.join(blood_groups_ts)}")

print("\nAvg Daily Demand per City (all blood groups combined):")
for city in cities_ts:
    city_rows = [r for r in rows if r["city"] == city]
    total = sum(r["units_demanded"] for r in city_rows)
    avg = total / num_days
    print(f"  {city:12s} : {avg:.1f} units/day")

print(f"\n>> Saved -> data/synthetic/blood_demand_timeseries.csv")

# ================================================================
print("\n" + "=" * 60)
print("ALL DATASETS GENERATED SUCCESSFULLY!")
print("=" * 60)
print(f"""
  data/processed/all_messages.json          : {len(unique_messages)} blood request messages
  data/synthetic/donor_registry_50k.csv     : {len(donors)} donor profiles
  data/synthetic/blood_demand_timeseries.csv : {len(rows)} time-series rows

  Ready for:
    Stage 1 (Preprocessing)  -> all_messages.json
    Stage 2 (Urgency Triage) -> all_messages.json (urgency labels)
    Stage 3 (NER)            -> all_messages.json (entity fields)
    Stage 4 (Donor Matching) -> donor_registry_50k.csv
    Stage 5 (Forecasting)    -> blood_demand_timeseries.csv
""")
