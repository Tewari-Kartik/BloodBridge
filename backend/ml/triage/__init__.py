"""
BloodBridge — Triage Module (Stage 2)
======================================
4-class urgency classification for blood request messages.

Classes:
    P0_CRITICAL → Life-threatening, immediate action
    P1_HIGH     → Urgent, within hours
    P2_MODERATE → Planned, within days
    P3_INFO     → General info, no urgency

Exports:
    - UrgencyClassifier: Model wrapper for training and inference
    - LABEL2ID / ID2LABEL: Label mappings
    - train (function): Run the full training pipeline
"""

from backend.ml.triage.data_prep import LABEL2ID, ID2LABEL, NUM_LABELS
from backend.ml.triage.classifier import UrgencyClassifier

__all__ = [
    'UrgencyClassifier',
    'LABEL2ID',
    'ID2LABEL',
    'NUM_LABELS',
]
