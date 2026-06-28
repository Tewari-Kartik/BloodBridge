"""Test NER extractor on actual dataset."""
import sys, os, io, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.path.insert(0, os.getcwd())

from backend.ml.ner.extractor import BloodRequestNER
from collections import Counter

ner = BloodRequestNER()

# ── Demo on hand-picked examples ──
print("=" * 60)
print("DEMO: NER Extraction")
print("=" * 60)

demos = [
    "URGENT! Need 3 units O- blood at AIIMS Delhi. Patient in ICU after road accident. Call 9876543210",
    "My sister needs 2 units AB+ for surgery tomorrow at Fortis Gurgaon. Contact 7012345678",
    "Blood donation camp this Sunday at Rotary Club, Connaught Place, Delhi. Free health checkup!",
    "Mere papa ka accident ho gaya hai. 4 units B- chahiye PGIMER Chandigarh mein. Jaldi contact karo",
    "Thalassemia patient at KEM Mumbai needs regular B+ transfusion. 2 units required by Thursday.",
]

for i, text in enumerate(demos, 1):
    result = ner.extract(text)
    safe_text = text[:80].encode('ascii', 'replace').decode('ascii')
    print(f"\n--- Message {i} ---")
    print(f"  TEXT: {safe_text}...")
    print(f"  ENTITIES ({result['entity_count']}):")
    for e in result['entities']:
        print(f"    {e['type']:20s} = {e['value']:25s} (conf: {e['confidence']:.2f})")

    # Show annotated text
    annotated = ner.annotate(text)
    safe_ann = annotated[:100].encode('ascii', 'replace').decode('ascii')
    print(f"  ANNOTATED: {safe_ann}...")

# ── Run on full dataset ──
print("\n" + "=" * 60)
print("FULL DATASET: Processing 1,507 messages")
print("=" * 60)

with open('data/processed/all_messages.json', 'r', encoding='utf-8') as f:
    messages = json.load(f)

# Extract entities from all messages
type_counts = Counter()
extraction_rates = Counter()
total_entities = 0

for msg in messages:
    result = ner.extract(msg['message'])
    total_entities += result['entity_count']
    for e in result['entities']:
        type_counts[e['type']] += 1
    # Track which entity types were found per message
    found_types = set(e['type'] for e in result['entities'])
    for t in found_types:
        extraction_rates[t] += 1

print(f"\nTotal entities extracted: {total_entities}")
print(f"Avg entities per message: {total_entities/len(messages):.1f}")

print(f"\n--- Entity Type Distribution ---")
for etype, count in type_counts.most_common():
    rate = extraction_rates[etype] / len(messages) * 100
    print(f"  {etype:20s}: {count:5d} entities  (found in {rate:.1f}% of messages)")

# ── Accuracy check against labeled data ──
print(f"\n--- Accuracy vs Ground Truth ---")
bg_correct, bg_total = 0, 0
hosp_correct, hosp_total = 0, 0

for msg in messages:
    result = ner.extract(msg['message'])
    extracted_bgs = [e['value'] for e in result['entities'] if e['type'] == 'BLOOD_GROUP']
    true_bg = msg.get('blood_group', 'NONE')

    if true_bg != 'NONE':
        bg_total += 1
        if true_bg in extracted_bgs:
            bg_correct += 1

    extracted_hosps = [e['value'].lower() for e in result['entities'] if e['type'] == 'HOSPITAL']
    true_hosp = msg.get('hospital', '').lower()
    if true_hosp:
        hosp_total += 1
        if any(true_hosp in eh or eh in true_hosp for eh in extracted_hosps):
            hosp_correct += 1

print(f"  Blood Group: {bg_correct}/{bg_total} ({bg_correct/max(bg_total,1)*100:.1f}%)")
print(f"  Hospital:    {hosp_correct}/{hosp_total} ({hosp_correct/max(hosp_total,1)*100:.1f}%)")
print(f"\nStage 3 NER: DONE")
