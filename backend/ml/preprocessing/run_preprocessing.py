"""
BloodBridge — Preprocessing Test & Demo
=========================================
Runs the preprocessing pipeline against the actual dataset (1,507 messages)
and prints detailed results.

Usage:
    uv run python -m backend.ml.preprocessing.run_preprocessing
"""

import json
import sys
import os
import io

# Fix Windows console encoding for emoji/unicode
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))))

from backend.ml.preprocessing.cleaner import BloodRequestCleaner
from backend.ml.preprocessing.language_detect import LanguageDetector
from backend.ml.preprocessing.pipeline import PreprocessingPipeline


def safe_print(text):
    """Print with emoji fallback for Windows console."""
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode('ascii', 'replace').decode('ascii'))


def demo_individual_components():
    """Demo each component separately with hand-picked examples."""

    safe_print("=" * 70)
    safe_print("DEMO 1: Text Cleaner")
    safe_print("=" * 70)

    cleaner = BloodRequestCleaner()

    test_messages = [
        "URGENT!! Need 3 units O -ve blood at AIIMS Delhi. Contact 9876543210 plz share",
        "Reqd 2 units B+ blood for pnt at Fortis Gurgaon. Surgery kal hai. Contct 7012345678",
        "Blood donation camp this Sunday at CP Delhi. Free checkup! #BloodDonation #SaveLives",
        "My sister needs AB- blood. Safdarjung Hospital Delhi. Please help",
        "Mere papa ka accident ho gaya hai. AIIMS mein admitted. O negative chahiye urgently. 9845612345",
    ]

    for i, msg in enumerate(test_messages, 1):
        result = cleaner.clean(msg)
        safe_print(f"\n--- Message {i} ---")
        safe_print(f"  ORIGINAL : {result['original'][:90]}")
        safe_print(f"  CLEANED  : {result['cleaned'][:90]}")
        safe_print(f"  BLOOD GRP: {result['extracted_blood_groups']}")
        safe_print(f"  PHONES   : {result['extracted_phones']}")
        safe_print(f"  HASHTAGS : {result['extracted_hashtags']}")
        safe_print(f"  URGENCY  : {result['has_urgency_keywords']}")

    safe_print("\n" + "=" * 70)
    safe_print("DEMO 2: Language Detector")
    safe_print("=" * 70)

    detector = LanguageDetector()

    lang_tests = [
        ("Need O- blood at AIIMS Delhi urgently", "english"),
        ("Blood donation camp this Sunday at CP Delhi", "english"),
        ("Mere papa ka accident ho gaya hai AIIMS mein", "hinglish"),
        ("Bhai kisi ko pata hai B+ blood kahan milega?", "hinglish"),
        ("My sister needs AB- blood at Safdarjung Hospital", "english"),
    ]

    correct = 0
    for text, expected in lang_tests:
        result = detector.detect(text)
        detected = result['language']
        match = "[PASS]" if detected == expected else "[FAIL]"
        if detected == expected:
            correct += 1
        safe_print(f"  {match} [{detected:10s}] (expected: {expected:10s}) | "
                   f"conf={result['confidence']:.2f} | {text[:55]}")

    safe_print(f"\n  Accuracy: {correct}/{len(lang_tests)} ({correct/len(lang_tests)*100:.0f}%)")


def run_full_pipeline():
    """Run the full pipeline on the actual dataset."""

    safe_print("\n" + "=" * 70)
    safe_print("FULL PIPELINE: Processing all 1,507 messages")
    safe_print("=" * 70)

    input_path = os.path.join("data", "processed", "all_messages.json")
    output_path = os.path.join("data", "processed", "preprocessed_messages.json")

    if not os.path.exists(input_path):
        safe_print(f"ERROR: {input_path} not found. Run generate_all_data.py first.")
        return

    pipeline = PreprocessingPipeline(skip_tokenization=True)
    summary = pipeline.process_file(input_path, output_path, verbose=True)

    # Show sample outputs
    safe_print("\n" + "=" * 70)
    safe_print("SAMPLE OUTPUTS (5 random messages)")
    safe_print("=" * 70)

    with open(output_path, 'r', encoding='utf-8') as f:
        processed = json.load(f)

    import random
    random.seed(42)
    samples = random.sample(processed, min(5, len(processed)))

    for i, sample in enumerate(samples, 1):
        safe_print(f"\n--- Sample {i} ---")
        # Use only ASCII-safe parts for display
        cleaned_safe = sample['cleaned'][:90].encode('ascii', 'replace').decode('ascii')
        safe_print(f"  CLEANED  : {cleaned_safe}")
        safe_print(f"  LANGUAGE : {sample['language']['language']} "
                   f"(conf: {sample['language']['confidence']:.2f})")
        safe_print(f"  BLOOD GRP: {sample['extracted']['blood_groups']}")
        safe_print(f"  URGENCY  : {sample['extracted']['has_urgency_keywords']}")
        safe_print(f"  WORDS    : {sample['stats']['word_count']}")
        safe_print(f"  TIME     : {sample['processing_time_ms']:.2f}ms")

        if 'metadata' in sample:
            meta = sample['metadata']
            safe_print(f"  LABEL    : {meta.get('urgency', 'N/A')} | "
                       f"{meta.get('blood_group', 'N/A')} | "
                       f"{meta.get('hospital', 'N/A')}")

    # Final stats
    safe_print("\n" + "=" * 70)
    safe_print("FINAL STATS")
    safe_print("=" * 70)
    safe_print(f"  Total messages processed : {len(processed)}")
    safe_print(f"  Output saved to          : {output_path}")

    # Language breakdown from processed data
    from collections import Counter
    lang_dist = Counter(p['language']['language'] for p in processed)
    safe_print(f"\n  Language breakdown:")
    for lang, count in lang_dist.most_common():
        safe_print(f"    {lang:12s} : {count:4d} ({count/len(processed)*100:.1f}%)")

    bg_found = sum(1 for p in processed if p['extracted']['blood_groups'])
    urgency_found = sum(1 for p in processed if p['extracted']['has_urgency_keywords'])
    safe_print(f"\n  Blood groups extracted    : {bg_found}/{len(processed)} ({bg_found/len(processed)*100:.1f}%)")
    safe_print(f"  Urgency keywords found    : {urgency_found}/{len(processed)} ({urgency_found/len(processed)*100:.1f}%)")

    avg_words = sum(p['stats']['word_count'] for p in processed) / len(processed)
    avg_time = sum(p['processing_time_ms'] for p in processed) / len(processed)
    safe_print(f"  Avg word count            : {avg_words:.1f}")
    safe_print(f"  Avg processing time       : {avg_time:.3f}ms per message")
    safe_print(f"  Total processing time     : {sum(p['processing_time_ms'] for p in processed)/1000:.2f}s")


if __name__ == "__main__":
    demo_individual_components()
    run_full_pipeline()
