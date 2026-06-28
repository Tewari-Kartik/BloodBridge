"""Merge all batch JSON files into one clean dataset and analyze it."""
import json
import os
from collections import Counter

RAW_DIR = r"C:\Users\Kartik Tewari\.gemini\antigravity\scratch\bloodbridge\data\raw"
OUT_FILE = r"C:\Users\Kartik Tewari\.gemini\antigravity\scratch\bloodbridge\data\processed\all_messages.json"

# 1. Merge all batches
all_messages = []
batch_files = sorted([f for f in os.listdir(RAW_DIR) if f.startswith("batch_") and f.endswith(".json")])

for fname in batch_files:
    fpath = os.path.join(RAW_DIR, fname)
    with open(fpath, "r", encoding="utf-8") as f:
        batch = json.load(f)
    print(f"  {fname}: {len(batch)} messages")
    all_messages.extend(batch)

print(f"\nTotal messages (before dedup): {len(all_messages)}")

# 2. Deduplicate by message text
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

# 3. Analyze
print("\n" + "=" * 50)
print("DATASET ANALYSIS")
print("=" * 50)

urgency_counts = Counter(m.get("urgency", "UNKNOWN") for m in unique_messages)
print("\nUrgency Distribution:")
for urg, count in sorted(urgency_counts.items()):
    pct = count / len(unique_messages) * 100
    bar = "█" * int(pct / 2)
    print(f"  {urg:15s} : {count:4d} ({pct:5.1f}%) {bar}")

bg_counts = Counter(m.get("blood_group", "UNKNOWN") for m in unique_messages)
print("\nBlood Group Distribution:")
for bg, count in sorted(bg_counts.items(), key=lambda x: -x[1]):
    pct = count / len(unique_messages) * 100
    print(f"  {bg:5s} : {count:4d} ({pct:5.1f}%)")

city_counts = Counter(m.get("city", "UNKNOWN") for m in unique_messages)
print("\nTop Cities:")
for city, count in city_counts.most_common(10):
    print(f"  {city:20s} : {count:4d}")

lang_counts = Counter(m.get("language", "UNKNOWN") for m in unique_messages)
print("\nLanguage Distribution:")
for lang, count in lang_counts.items():
    print(f"  {lang:10s} : {count:4d}")

has_contact = sum(1 for m in unique_messages if m.get("has_contact"))
print(f"\nMessages with contact info: {has_contact}/{len(unique_messages)} ({has_contact/len(unique_messages)*100:.1f}%)")

# Check for required fields
required_fields = ["message", "urgency", "blood_group", "hospital", "city", "units_needed", "patient_condition"]
missing = {f: 0 for f in required_fields}
for msg in unique_messages:
    for field in required_fields:
        if field not in msg or msg[field] is None:
            missing[field] += 1

print("\nMissing Fields:")
for field, count in missing.items():
    status = "✓" if count == 0 else f"✗ {count} missing"
    print(f"  {field:20s} : {status}")

# 4. Save merged dataset
os.makedirs(os.path.dirname(OUT_FILE), exist_ok=True)
with open(OUT_FILE, "w", encoding="utf-8") as f:
    json.dump(unique_messages, f, ensure_ascii=False, indent=2)

print(f"\n✅ Saved {len(unique_messages)} unique messages to:")
print(f"   {OUT_FILE}")
