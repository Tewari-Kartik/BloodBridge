"""
BloodBridge — Urgency Classifier
==================================
Fine-tuned MuRIL transformer for 4-class urgency classification.

Classes:
    0 = P0_CRITICAL  (life-threatening, immediate action)
    1 = P1_HIGH      (urgent, within hours)
    2 = P2_MODERATE  (planned, within days)
    3 = P3_INFO      (general info, no urgency)

Architecture:
    MuRIL Base → [CLS] embedding (768-dim) → Dropout → Linear (4 classes)

Usage:
    # Inference (after training)
    classifier = UrgencyClassifier.load("backend/models/urgency_classifier")
    result = classifier.predict("Need O- blood at AIIMS Delhi ASAP!")
    # → {"urgency": "P0_CRITICAL", "confidence": 0.94, ...}
"""

import os
import json
from typing import Optional, Union

import torch
import torch.nn.functional as F

from backend.ml.triage.data_prep import LABEL2ID, ID2LABEL, NUM_LABELS


class UrgencyClassifier:
    """
    Urgency classifier for blood request messages.

    Wraps a HuggingFace sequence classification model with
    domain-specific prediction logic.
    """

    def __init__(self, model=None, tokenizer=None,
                 device: Optional[str] = None):
        """
        Initialize the classifier.

        Args:
            model: A loaded HuggingFace model (AutoModelForSequenceClassification).
            tokenizer: A loaded HuggingFace tokenizer.
            device: Device to run inference on ("cpu", "cuda", "mps").
                    Auto-detected if None.
        """
        self.model = model
        self.tokenizer = tokenizer

        if device is None:
            if torch.cuda.is_available():
                self.device = "cuda"
            elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                self.device = "mps"
            else:
                self.device = "cpu"
        else:
            self.device = device

        if self.model is not None:
            self.model.to(self.device)
            self.model.eval()

    @classmethod
    def from_pretrained(cls, model_name: str = "google/muril-base-cased",
                        device: Optional[str] = None):
        """
        Create a classifier from a pre-trained base model (before fine-tuning).

        Args:
            model_name: HuggingFace model name.
            device: Device for inference.

        Returns:
            UrgencyClassifier instance (untrained, for fine-tuning).
        """
        from transformers import AutoModelForSequenceClassification, AutoTokenizer

        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForSequenceClassification.from_pretrained(
            model_name,
            num_labels=NUM_LABELS,
            id2label=ID2LABEL,
            label2id=LABEL2ID,
            problem_type="single_label_classification",
        )

        print(f"[Classifier] Loaded base model: {model_name}")
        print(f"[Classifier] Parameters: {sum(p.numel() for p in model.parameters()):,}")

        return cls(model=model, tokenizer=tokenizer, device=device)

    @classmethod
    def load(cls, model_dir: str, device: Optional[str] = None):
        """
        Load a fine-tuned classifier from a saved directory.

        Args:
            model_dir: Path to saved model directory (contains model + tokenizer).
            device: Device for inference.

        Returns:
            UrgencyClassifier ready for inference.
        """
        from transformers import AutoModelForSequenceClassification, AutoTokenizer

        tokenizer = AutoTokenizer.from_pretrained(model_dir)
        model = AutoModelForSequenceClassification.from_pretrained(model_dir)

        print(f"[Classifier] Loaded fine-tuned model from: {model_dir}")
        return cls(model=model, tokenizer=tokenizer, device=device)

    def save(self, output_dir: str):
        """
        Save the fine-tuned model and tokenizer.

        Args:
            output_dir: Directory to save model files.
        """
        os.makedirs(output_dir, exist_ok=True)
        self.model.save_pretrained(output_dir)
        self.tokenizer.save_pretrained(output_dir)

        # Save label mapping for reference
        meta = {
            "label2id": LABEL2ID,
            "id2label": {str(k): v for k, v in ID2LABEL.items()},
            "num_labels": NUM_LABELS,
        }
        with open(os.path.join(output_dir, "label_config.json"), "w") as f:
            json.dump(meta, f, indent=2)

        print(f"[Classifier] Model saved to: {output_dir}")

    @torch.no_grad()
    def predict(self, text: str, apply_cleaning: bool = True) -> dict:
        """
        Predict urgency for a single message.

        Args:
            text: Raw or cleaned message text.
            apply_cleaning: Apply text preprocessing before prediction.

        Returns:
            Dictionary with:
                - urgency: Predicted label ("P0_CRITICAL", etc.)
                - label_id: Numeric label (0-3)
                - confidence: Softmax probability of predicted class
                - probabilities: Dict of all class probabilities
                - is_critical: Boolean shortcut for P0/P1
        """
        if apply_cleaning:
            from backend.ml.preprocessing.cleaner import BloodRequestCleaner
            cleaner = BloodRequestCleaner()
            cleaned = cleaner.clean(text)
            text = cleaned["cleaned"]

        # Tokenize
        inputs = self.tokenizer(
            text,
            max_length=256,
            padding="max_length",
            truncation=True,
            return_tensors="pt",
        ).to(self.device)

        # Forward pass
        outputs = self.model(**inputs)
        logits = outputs.logits[0]
        probs = F.softmax(logits, dim=-1).cpu()

        predicted_id = probs.argmax().item()
        predicted_label = ID2LABEL[predicted_id]
        confidence = probs[predicted_id].item()

        return {
            "urgency": predicted_label,
            "label_id": predicted_id,
            "confidence": round(confidence, 4),
            "probabilities": {
                ID2LABEL[i]: round(probs[i].item(), 4)
                for i in range(NUM_LABELS)
            },
            "is_critical": predicted_id <= 1,  # P0 or P1
        }

    @torch.no_grad()
    def predict_batch(self, texts: list, apply_cleaning: bool = True,
                      batch_size: int = 32) -> list:
        """
        Predict urgency for a batch of messages.

        Args:
            texts: List of message strings.
            apply_cleaning: Apply text preprocessing.
            batch_size: Batch size for inference.

        Returns:
            List of prediction dicts (same format as predict()).
        """
        if apply_cleaning:
            from backend.ml.preprocessing.cleaner import BloodRequestCleaner
            cleaner = BloodRequestCleaner()
            texts = [cleaner.clean(t)["cleaned"] for t in texts]

        results = []

        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i:i + batch_size]

            inputs = self.tokenizer(
                batch_texts,
                max_length=256,
                padding="max_length",
                truncation=True,
                return_tensors="pt",
            ).to(self.device)

            outputs = self.model(**inputs)
            probs = F.softmax(outputs.logits, dim=-1).cpu()

            for j in range(len(batch_texts)):
                p = probs[j]
                predicted_id = p.argmax().item()

                results.append({
                    "urgency": ID2LABEL[predicted_id],
                    "label_id": predicted_id,
                    "confidence": round(p[predicted_id].item(), 4),
                    "probabilities": {
                        ID2LABEL[k]: round(p[k].item(), 4)
                        for k in range(NUM_LABELS)
                    },
                    "is_critical": predicted_id <= 1,
                })

        return results

class RuleBasedUrgencyClassifier:
    """
    Lightweight keyword-based fallback classifier.
    Used when the MuRIL model cannot be loaded (e.g., due to RAM limits on free tier).
    """
    def __init__(self):
        self.p0_keywords = ["critical", "emergency", "urgent", "icu", "accident", "asap", "dying", "immediate", "turant", "ghayal", "gambhir"]
        self.p1_keywords = ["surgery", "operation", "needed by", "tomorrow", "today", "hospital"]
        self.p3_keywords = ["camp", "blood donation camp", "donate", "free checkup", "awareness"]

    def predict(self, text: str, apply_cleaning: bool = True) -> dict:
        text_lower = text.lower()
        
        if any(kw in text_lower for kw in self.p0_keywords):
            urgency = "P0_CRITICAL"
            label_id = 0
            probs = {"P0_CRITICAL": 0.85, "P1_HIGH": 0.10, "P2_MODERATE": 0.04, "P3_INFO": 0.01}
        elif any(kw in text_lower for kw in self.p3_keywords):
            urgency = "P3_INFO"
            label_id = 3
            probs = {"P0_CRITICAL": 0.01, "P1_HIGH": 0.04, "P2_MODERATE": 0.10, "P3_INFO": 0.85}
        elif any(kw in text_lower for kw in self.p1_keywords):
            urgency = "P1_HIGH"
            label_id = 1
            probs = {"P0_CRITICAL": 0.15, "P1_HIGH": 0.75, "P2_MODERATE": 0.08, "P3_INFO": 0.02}
        else:
            urgency = "P2_MODERATE"
            label_id = 2
            probs = {"P0_CRITICAL": 0.05, "P1_HIGH": 0.15, "P2_MODERATE": 0.75, "P3_INFO": 0.05}
            
        return {
            "urgency": urgency,
            "label_id": label_id,
            "confidence": probs[urgency],
            "probabilities": probs,
            "is_critical": label_id <= 1,
            "is_fallback": True
        }
