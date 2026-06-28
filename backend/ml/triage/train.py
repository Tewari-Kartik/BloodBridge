"""
BloodBridge — Urgency Classifier Training
===========================================
Fine-tunes MuRIL on blood request messages for 4-class urgency classification.

Training Strategy:
    1. Load pre-trained MuRIL (google/muril-base-cased)
    2. Add classification head (768 → 4)
    3. Fine-tune with weighted cross-entropy loss (handles class imbalance)
    4. Evaluate on validation set after each epoch
    5. Save best model based on F1 score

Usage:
    uv run python -m backend.ml.triage.train

Configuration is at the top of this file — adjust batch_size and epochs
based on your hardware (CPU vs GPU).
"""

import os
import sys
import json
import time

import numpy as np
import torch
from torch import nn
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    Trainer,
    TrainingArguments,
    EarlyStoppingCallback,
)

# Project imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))))

from backend.ml.triage.data_prep import (
    load_messages, stratified_split, create_hf_datasets,
    compute_class_weights, save_splits, LABEL2ID, ID2LABEL, NUM_LABELS
)
from backend.ml.triage.evaluate import compute_metrics_for_trainer, full_evaluation
from backend.ml.triage.classifier import UrgencyClassifier


# ════════════════════════════════════════════════════════════
# CONFIGURATION — Adjust these based on your hardware
# ════════════════════════════════════════════════════════════

CONFIG = {
    # Model
    "model_name": "google/muril-base-cased",
    "max_length": 128,              # Reduced from 256 (our messages avg 24 words)

    # Data
    "data_path": "data/processed/all_messages.json",
    "splits_dir": "data/processed/splits",
    "train_ratio": 0.8,
    "val_ratio": 0.1,
    "test_ratio": 0.1,

    # Training (optimized for CPU)
    "epochs": 5,                    # Reduced from 10 (early stopping will handle it)
    "batch_size": 8,                # Reduced from 16 for CPU
    "learning_rate": 2e-5,          # Standard for transformer fine-tuning
    "weight_decay": 0.01,           # L2 regularization
    "warmup_ratio": 0.1,            # 10% warmup steps
    "gradient_accumulation": 2,     # Effective batch size = 8*2 = 16
    "fp16": False,                  # CPU doesn't support fp16
    "early_stopping_patience": 3,

    # Output
    "output_dir": "backend/models/urgency_classifier",
    "logging_dir": "backend/models/urgency_classifier/logs",

    # Reproducibility
    "seed": 42,
}


class WeightedTrainer(Trainer):
    """
    Custom Trainer that applies class weights to the loss function.
    This is critical for handling imbalanced datasets where P3_INFO
    has far fewer samples than P0_CRITICAL.
    """

    def __init__(self, class_weights=None, **kwargs):
        super().__init__(**kwargs)
        if class_weights is not None:
            weights = torch.tensor(
                [class_weights[i] for i in range(NUM_LABELS)],
                dtype=torch.float32,
            )
            self.class_weights = weights
        else:
            self.class_weights = None

    def compute_loss(self, model, inputs, return_outputs=False, **kwargs):
        """Override loss computation to use class weights."""
        labels = inputs.pop("labels")
        outputs = model(**inputs)
        logits = outputs.logits

        if self.class_weights is not None:
            weight = self.class_weights.to(logits.device)
            loss = nn.CrossEntropyLoss(weight=weight)(logits, labels)
        else:
            loss = nn.CrossEntropyLoss()(logits, labels)

        return (loss, outputs) if return_outputs else loss


def train():
    """Run the full training pipeline."""

    print("=" * 60)
    print("BloodBridge — Urgency Classifier Training")
    print("=" * 60)
    print(f"\nConfig:")
    for key, val in CONFIG.items():
        print(f"  {key}: {val}")

    # Detect device
    if torch.cuda.is_available():
        device_name = torch.cuda.get_device_name(0)
        print(f"\nDevice: CUDA ({device_name})")
        CONFIG["fp16"] = True
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        print("\nDevice: Apple MPS")
    else:
        print("\nDevice: CPU (training will be slower)")
        print("  TIP: Reduce batch_size to 8 and epochs to 5 for CPU")

    # ── Step 1: Load and split data ──
    print("\n" + "-" * 40)
    print("Step 1: Loading and splitting data")
    print("-" * 40)

    messages = load_messages(CONFIG["data_path"])
    splits = stratified_split(
        messages,
        train_ratio=CONFIG["train_ratio"],
        val_ratio=CONFIG["val_ratio"],
        test_ratio=CONFIG["test_ratio"],
        seed=CONFIG["seed"],
    )
    save_splits(splits, CONFIG["splits_dir"])

    # ── Step 2: Compute class weights ──
    class_weights = compute_class_weights(splits["train"])

    # ── Step 3: Create tokenized datasets ──
    print("\n" + "-" * 40)
    print("Step 2: Tokenizing datasets")
    print("-" * 40)

    hf_datasets = create_hf_datasets(
        splits,
        tokenizer_name=CONFIG["model_name"],
        max_length=CONFIG["max_length"],
        apply_cleaning=True,
    )

    # ── Step 4: Load model ──
    print("\n" + "-" * 40)
    print("Step 3: Loading pre-trained model")
    print("-" * 40)

    tokenizer = AutoTokenizer.from_pretrained(CONFIG["model_name"])
    model = AutoModelForSequenceClassification.from_pretrained(
        CONFIG["model_name"],
        num_labels=NUM_LABELS,
        id2label=ID2LABEL,
        label2id=LABEL2ID,
        problem_type="single_label_classification",
    )

    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"  Total parameters    : {total_params:,}")
    print(f"  Trainable parameters: {trainable_params:,}")

    # ── Step 5: Configure training ──
    print("\n" + "-" * 40)
    print("Step 4: Configuring training")
    print("-" * 40)

    training_args = TrainingArguments(
        output_dir=CONFIG["output_dir"],
        num_train_epochs=CONFIG["epochs"],
        per_device_train_batch_size=CONFIG["batch_size"],
        per_device_eval_batch_size=CONFIG["batch_size"] * 2,
        learning_rate=CONFIG["learning_rate"],
        weight_decay=CONFIG["weight_decay"],
        warmup_ratio=CONFIG["warmup_ratio"],
        gradient_accumulation_steps=CONFIG["gradient_accumulation"],
        fp16=CONFIG["fp16"],

        # Evaluation strategy
        eval_strategy="epoch",
        save_strategy="epoch",
        logging_strategy="steps",
        logging_steps=10,

        # Save best model
        load_best_model_at_end=True,
        metric_for_best_model="f1_weighted",
        greater_is_better=True,
        save_total_limit=2,

        # Logging
        logging_dir=CONFIG["logging_dir"],
        report_to="none",

        # Reproducibility
        seed=CONFIG["seed"],
        data_seed=CONFIG["seed"],

        # Disable tqdm in non-interactive environments
        disable_tqdm=False,
    )

    # ── Step 6: Train ──
    print("\n" + "-" * 40)
    print("Step 5: Training")
    print("-" * 40)

    trainer = WeightedTrainer(
        class_weights=class_weights,
        model=model,
        args=training_args,
        train_dataset=hf_datasets["train"],
        eval_dataset=hf_datasets["val"],
        compute_metrics=compute_metrics_for_trainer,
        callbacks=[EarlyStoppingCallback(early_stopping_patience=CONFIG["early_stopping_patience"])],
    )

    start_time = time.time()
    train_result = trainer.train()
    train_time = time.time() - start_time

    print(f"\n  Training completed in {train_time:.1f}s ({train_time/60:.1f} min)")
    print(f"  Training loss: {train_result.training_loss:.4f}")

    # ── Step 7: Save model ──
    print("\n" + "-" * 40)
    print("Step 6: Saving best model")
    print("-" * 40)

    best_model_dir = os.path.join(CONFIG["output_dir"], "best_model")
    trainer.save_model(best_model_dir)
    tokenizer.save_pretrained(best_model_dir)

    # Save label config
    meta = {
        "label2id": LABEL2ID,
        "id2label": {str(k): v for k, v in ID2LABEL.items()},
        "num_labels": NUM_LABELS,
        "model_name": CONFIG["model_name"],
        "training_time_seconds": round(train_time, 1),
        "config": CONFIG,
    }
    with open(os.path.join(best_model_dir, "label_config.json"), "w") as f:
        json.dump(meta, f, indent=2)

    print(f"  Model saved to: {best_model_dir}")

    # ── Step 8: Evaluate on test set ──
    print("\n" + "-" * 40)
    print("Step 7: Evaluating on test set")
    print("-" * 40)

    # Load the saved model for evaluation
    classifier = UrgencyClassifier.load(best_model_dir)
    eval_result = full_evaluation(
        classifier,
        splits["test"],
        output_dir=os.path.join(CONFIG["output_dir"], "evaluation"),
    )

    # ── Step 9: Quick sanity check ──
    print("\n" + "-" * 40)
    print("Step 8: Sanity check predictions")
    print("-" * 40)

    sanity_tests = [
        "URGENT! Need O- blood at AIIMS Delhi. Patient in ICU after accident.",
        "My sister needs 2 units B+ blood for surgery tomorrow at Apollo Chennai.",
        "Looking for A+ blood donors for a transfusion scheduled next week at Fortis Gurgaon.",
        "Blood donation camp this Sunday at Rotary Club Delhi. Free checkup!",
    ]
    expected = ["P0_CRITICAL", "P1_HIGH", "P2_MODERATE", "P3_INFO"]

    for text, exp in zip(sanity_tests, expected):
        pred = classifier.predict(text)
        match = "PASS" if pred["urgency"] == exp else "FAIL"
        safe_text = text[:70].encode('ascii', 'replace').decode('ascii')
        print(f"  [{match}] Expected={exp:15s} | Got={pred['urgency']:15s} | "
              f"Conf={pred['confidence']:.3f}")
        print(f"        \"{safe_text}\"")

    # ── Summary ──
    print("\n" + "=" * 60)
    print("TRAINING COMPLETE")
    print("=" * 60)
    print(f"  Model         : {best_model_dir}")
    print(f"  Accuracy      : {eval_result['accuracy']:.4f}")
    print(f"  F1 (weighted) : {eval_result['f1_weighted']:.4f}")
    print(f"  F1 (macro)    : {eval_result['f1_macro']:.4f}")
    print(f"  P0 Recall     : {eval_result['p0_recall']:.4f}")
    print(f"  Training time : {train_time/60:.1f} minutes")
    print(f"  Errors        : {eval_result['num_errors']}/{eval_result['num_test_samples']}")

    return eval_result


if __name__ == "__main__":
    train()
