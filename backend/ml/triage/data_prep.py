"""
BloodBridge — Triage Data Preparation
=======================================
Converts raw message JSON into HuggingFace Dataset objects
ready for transformer fine-tuning.

Handles:
- Label encoding (P0_CRITICAL=0, P1_HIGH=1, P2_MODERATE=2, P3_INFO=3)
- Stratified train/val/test split (80/10/10)
- Text preprocessing integration
- Class weight computation for imbalanced data
"""

import json
import os
import random
from collections import Counter
from typing import Optional

# Label mapping (ordered by severity: 0=most urgent)
LABEL2ID = {
    "P0_CRITICAL": 0,
    "P1_HIGH": 1,
    "P2_MODERATE": 2,
    "P3_INFO": 3,
}
ID2LABEL = {v: k for k, v in LABEL2ID.items()}
NUM_LABELS = len(LABEL2ID)


def load_messages(json_path: str) -> list:
    """Load messages from the merged JSON file."""
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Validate that urgency labels exist
    valid = []
    skipped = 0
    for msg in data:
        urgency = msg.get("urgency", "").strip()
        if urgency in LABEL2ID:
            valid.append(msg)
        else:
            skipped += 1

    if skipped > 0:
        print(f"[DataPrep] WARNING: Skipped {skipped} messages with invalid/missing urgency labels")
    print(f"[DataPrep] Loaded {len(valid)} messages with valid labels")
    return valid


def stratified_split(messages: list, train_ratio: float = 0.8,
                     val_ratio: float = 0.1, test_ratio: float = 0.1,
                     seed: int = 42) -> dict:
    """
    Split messages into train/val/test sets with stratification by urgency label.

    Args:
        messages: List of message dicts with 'urgency' field.
        train_ratio: Fraction for training (default 0.8).
        val_ratio: Fraction for validation (default 0.1).
        test_ratio: Fraction for testing (default 0.1).
        seed: Random seed for reproducibility.

    Returns:
        Dict with 'train', 'val', 'test' lists.
    """
    assert abs(train_ratio + val_ratio + test_ratio - 1.0) < 1e-6, \
        "Ratios must sum to 1.0"

    random.seed(seed)

    # Group messages by urgency label
    by_label = {}
    for msg in messages:
        label = msg["urgency"]
        by_label.setdefault(label, []).append(msg)

    train, val, test = [], [], []

    for label, group in by_label.items():
        random.shuffle(group)
        n = len(group)
        n_train = int(n * train_ratio)
        n_val = int(n * val_ratio)

        train.extend(group[:n_train])
        val.extend(group[n_train:n_train + n_val])
        test.extend(group[n_train + n_val:])

    # Shuffle each split
    random.shuffle(train)
    random.shuffle(val)
    random.shuffle(test)

    print(f"[DataPrep] Split: train={len(train)}, val={len(val)}, test={len(test)}")

    # Print per-label distribution in each split
    for name, split in [("train", train), ("val", val), ("test", test)]:
        dist = Counter(m["urgency"] for m in split)
        parts = ", ".join(f"{LABEL2ID[k]}:{v}" for k, v in sorted(dist.items()))
        print(f"  {name:5s}: {parts}")

    return {"train": train, "val": val, "test": test}


def prepare_for_training(messages: list, apply_cleaning: bool = True) -> list:
    """
    Convert message dicts into training-ready format.

    Args:
        messages: List of message dicts.
        apply_cleaning: Whether to apply text preprocessing.

    Returns:
        List of dicts with 'text', 'label', 'label_name' fields.
    """
    if apply_cleaning:
        from backend.ml.preprocessing.cleaner import BloodRequestCleaner
        cleaner = BloodRequestCleaner(
            expand_abbreviations=True,
            mask_phone_numbers=True,
        )
    else:
        cleaner = None

    prepared = []
    for msg in messages:
        text = msg["message"]

        if cleaner is not None:
            cleaned = cleaner.clean(text)
            text = cleaned["cleaned"]

        prepared.append({
            "text": text,
            "label": LABEL2ID[msg["urgency"]],
            "label_name": msg["urgency"],
        })

    return prepared


def create_hf_datasets(splits: dict, tokenizer_name: str = "google/muril-base-cased",
                       max_length: int = 256, apply_cleaning: bool = True):
    """
    Create HuggingFace Dataset objects tokenized and ready for Trainer.

    Args:
        splits: Dict with 'train', 'val', 'test' message lists.
        tokenizer_name: HuggingFace tokenizer to use.
        max_length: Maximum token sequence length.
        apply_cleaning: Apply text preprocessing before tokenization.

    Returns:
        Dict with 'train', 'val', 'test' HuggingFace Datasets.
    """
    from datasets import Dataset
    from transformers import AutoTokenizer

    tokenizer = AutoTokenizer.from_pretrained(tokenizer_name)

    hf_datasets = {}
    for split_name, messages in splits.items():
        # Prepare text + labels
        prepared = prepare_for_training(messages, apply_cleaning=apply_cleaning)

        # Create HuggingFace Dataset
        ds = Dataset.from_dict({
            "text": [p["text"] for p in prepared],
            "label": [p["label"] for p in prepared],
            "label_name": [p["label_name"] for p in prepared],
        })

        # Tokenize
        def tokenize_fn(examples):
            return tokenizer(
                examples["text"],
                max_length=max_length,
                padding="max_length",
                truncation=True,
            )

        ds = ds.map(tokenize_fn, batched=True, desc=f"Tokenizing {split_name}")

        # Set format for PyTorch
        ds.set_format("torch", columns=["input_ids", "attention_mask", "label"])

        hf_datasets[split_name] = ds
        print(f"[DataPrep] {split_name}: {len(ds)} samples, "
              f"tokenized with max_length={max_length}")

    return hf_datasets


def compute_class_weights(train_messages: list) -> dict:
    """
    Compute class weights inversely proportional to frequency.
    Used to handle class imbalance (P3_INFO has fewer samples).

    Args:
        train_messages: Training split message list.

    Returns:
        Dict mapping label_id to weight (float).
    """
    counts = Counter(m["urgency"] for m in train_messages)
    total = sum(counts.values())
    n_classes = len(counts)

    weights = {}
    for label_name, count in counts.items():
        label_id = LABEL2ID[label_name]
        # Inverse frequency weighting: weight = total / (n_classes * count)
        weights[label_id] = total / (n_classes * count)

    print("[DataPrep] Class weights (for loss function):")
    for lid in sorted(weights.keys()):
        label = ID2LABEL[lid]
        print(f"  {label:15s} (id={lid}): weight={weights[lid]:.3f}")

    return weights


def save_splits(splits: dict, output_dir: str):
    """Save train/val/test splits as separate JSON files."""
    os.makedirs(output_dir, exist_ok=True)
    for name, messages in splits.items():
        path = os.path.join(output_dir, f"{name}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(messages, f, ensure_ascii=False, indent=2)
        print(f"[DataPrep] Saved {name} split ({len(messages)} msgs) -> {path}")
