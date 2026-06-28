"""
BloodBridge — Urgency Classifier Evaluation
=============================================
Computes and displays evaluation metrics for the urgency classifier.

Metrics:
- Per-class Precision, Recall, F1
- Weighted and Macro F1
- Confusion matrix
- P0 Recall (critical metric: must be > 0.95)
"""

import json
import os
from collections import Counter
from typing import Optional

import numpy as np


def compute_metrics_for_trainer(eval_pred):
    """
    Compute metrics compatible with HuggingFace Trainer.

    This function is passed to Trainer via compute_metrics parameter.
    Called automatically during evaluation.
    """
    from sklearn.metrics import (
        accuracy_score, f1_score, precision_score, recall_score
    )

    logits, labels = eval_pred
    predictions = np.argmax(logits, axis=-1)

    accuracy = accuracy_score(labels, predictions)
    f1_weighted = f1_score(labels, predictions, average="weighted", zero_division=0)
    f1_macro = f1_score(labels, predictions, average="macro", zero_division=0)
    precision_weighted = precision_score(labels, predictions, average="weighted", zero_division=0)
    recall_weighted = recall_score(labels, predictions, average="weighted", zero_division=0)

    # P0 Recall (CRITICAL metric — missing a P0 case can cost a life)
    p0_mask = labels == 0
    if p0_mask.sum() > 0:
        p0_recall = recall_score(
            labels[p0_mask] == 0,
            predictions[p0_mask] == 0,
            zero_division=0
        )
    else:
        p0_recall = 0.0

    return {
        "accuracy": round(accuracy, 4),
        "f1_weighted": round(f1_weighted, 4),
        "f1_macro": round(f1_macro, 4),
        "precision_weighted": round(precision_weighted, 4),
        "recall_weighted": round(recall_weighted, 4),
        "p0_recall": round(p0_recall, 4),
    }


def full_evaluation(classifier, test_messages: list,
                    output_dir: Optional[str] = None) -> dict:
    """
    Run comprehensive evaluation on a test set.

    Args:
        classifier: Trained UrgencyClassifier instance.
        test_messages: List of message dicts with 'message' and 'urgency' fields.
        output_dir: Optional directory to save evaluation report.

    Returns:
        Dictionary with all evaluation metrics.
    """
    from sklearn.metrics import (
        classification_report, confusion_matrix, accuracy_score, f1_score
    )
    from backend.ml.triage.data_prep import LABEL2ID, ID2LABEL

    # Get predictions
    texts = [m["message"] for m in test_messages]
    true_labels = [LABEL2ID[m["urgency"]] for m in test_messages]

    print(f"[Eval] Running predictions on {len(texts)} test messages...")
    predictions = classifier.predict_batch(texts, apply_cleaning=True)
    pred_labels = [p["label_id"] for p in predictions]
    pred_confidences = [p["confidence"] for p in predictions]

    # Classification report
    label_names = [ID2LABEL[i] for i in range(len(ID2LABEL))]
    report = classification_report(
        true_labels, pred_labels,
        target_names=label_names,
        output_dict=True,
        zero_division=0,
    )
    report_text = classification_report(
        true_labels, pred_labels,
        target_names=label_names,
        zero_division=0,
    )

    # Confusion matrix
    cm = confusion_matrix(true_labels, pred_labels)

    # Overall metrics
    accuracy = accuracy_score(true_labels, pred_labels)
    f1_weighted = f1_score(true_labels, pred_labels, average="weighted", zero_division=0)
    f1_macro = f1_score(true_labels, pred_labels, average="macro", zero_division=0)

    # P0 Recall (THE most important metric)
    p0_true = sum(1 for t in true_labels if t == 0)
    p0_correct = sum(1 for t, p in zip(true_labels, pred_labels) if t == 0 and p == 0)
    p0_recall = p0_correct / max(p0_true, 1)

    # Average confidence
    avg_confidence = sum(pred_confidences) / len(pred_confidences)

    # Confidence by correctness
    correct_confs = [c for t, p, c in zip(true_labels, pred_labels, pred_confidences) if t == p]
    wrong_confs = [c for t, p, c in zip(true_labels, pred_labels, pred_confidences) if t != p]
    avg_correct_conf = sum(correct_confs) / max(len(correct_confs), 1)
    avg_wrong_conf = sum(wrong_confs) / max(len(wrong_confs), 1)

    # Print results
    print("\n" + "=" * 60)
    print("URGENCY CLASSIFIER — EVALUATION RESULTS")
    print("=" * 60)

    print(f"\n--- Overall Metrics ---")
    print(f"  Accuracy          : {accuracy:.4f}")
    print(f"  F1 (weighted)     : {f1_weighted:.4f}")
    print(f"  F1 (macro)        : {f1_macro:.4f}")
    print(f"  P0 Recall         : {p0_recall:.4f}  {'PASS' if p0_recall >= 0.95 else 'NEEDS IMPROVEMENT'}")
    print(f"  Avg Confidence    : {avg_confidence:.4f}")
    print(f"  Correct Avg Conf  : {avg_correct_conf:.4f}")
    print(f"  Wrong Avg Conf    : {avg_wrong_conf:.4f}")

    print(f"\n--- Classification Report ---")
    print(report_text)

    print(f"--- Confusion Matrix ---")
    print(f"  Predicted →")
    print(f"  True ↓   ", end="")
    for name in label_names:
        print(f"  {name[:6]:>6s}", end="")
    print()
    for i, row in enumerate(cm):
        print(f"  {label_names[i][:15]:15s}", end="")
        for val in row:
            print(f"  {val:6d}", end="")
        print()

    # Error analysis: find worst misclassifications
    errors = []
    for msg, true_l, pred_p in zip(test_messages, true_labels, predictions):
        if true_l != pred_p["label_id"]:
            errors.append({
                "message": msg["message"][:100],
                "true": ID2LABEL[true_l],
                "predicted": pred_p["urgency"],
                "confidence": pred_p["confidence"],
            })

    print(f"\n--- Error Analysis ({len(errors)} errors) ---")
    # Show most confident errors (model was confident but wrong)
    errors.sort(key=lambda x: -x["confidence"])
    for err in errors[:5]:
        print(f"  True={err['true']:15s} | Pred={err['predicted']:15s} | "
              f"Conf={err['confidence']:.3f}")
        safe_msg = err['message'].encode('ascii', 'replace').decode('ascii')
        print(f"    \"{safe_msg}\"")

    # Build result dict
    result = {
        "accuracy": round(accuracy, 4),
        "f1_weighted": round(f1_weighted, 4),
        "f1_macro": round(f1_macro, 4),
        "p0_recall": round(p0_recall, 4),
        "avg_confidence": round(avg_confidence, 4),
        "per_class": report,
        "confusion_matrix": cm.tolist(),
        "num_test_samples": len(test_messages),
        "num_errors": len(errors),
        "error_rate": round(len(errors) / len(test_messages), 4),
    }

    # Save report if output_dir provided
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
        report_path = os.path.join(output_dir, "evaluation_report.json")
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        print(f"\n[Eval] Report saved to: {report_path}")

    return result
