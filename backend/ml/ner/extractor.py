"""
BloodBridge — Named Entity Extractor (Stage 3)
================================================
Hybrid NER system: regex patterns + gazetteer matching + contextual rules.

Extracts 7 entity types from blood request messages:
    BLOOD_GROUP      : O-, AB+, B positive, etc.
    HOSPITAL         : AIIMS Delhi, Fortis Gurgaon, etc.
    LOCATION         : City names and areas
    UNITS_NEEDED     : "3 units", "2 pints", etc.
    PATIENT_CONDITION: accident, thalassemia, surgery, etc.
    CONTACT          : Phone numbers
    TIME_CONSTRAINT  : ASAP, tomorrow, within 2 hours, etc.

Usage:
    from backend.ml.ner.extractor import BloodRequestNER
    ner = BloodRequestNER()
    entities = ner.extract("Need 3 units O- blood at AIIMS Delhi urgently! Call 9876543210")
"""

import re
from typing import Optional

from backend.ml.ner.entity_rules import (
    BLOOD_GROUP_PATTERN, normalize_blood_group,
    PHONE_PATTERN, UNITS_PATTERN, UNITS_BEFORE_BG,
    HOSPITAL_PATTERN, HOSPITALS,
    CITY_PATTERN, CITIES,
    CONDITION_PATTERN, CONDITION_KEYWORDS,
    TIME_PATTERNS,
)


class Entity:
    """Represents a single extracted entity with span information."""

    __slots__ = ('type', 'value', 'raw', 'start', 'end', 'confidence')

    def __init__(self, entity_type: str, value: str, raw: str,
                 start: int, end: int, confidence: float = 1.0):
        self.type = entity_type
        self.value = value      # Normalized value
        self.raw = raw          # Original text span
        self.start = start      # Start character offset
        self.end = end          # End character offset
        self.confidence = confidence

    def to_dict(self) -> dict:
        return {
            'type': self.type,
            'value': self.value,
            'raw': self.raw,
            'start': self.start,
            'end': self.end,
            'confidence': self.confidence,
        }

    def __repr__(self):
        return f"Entity({self.type}='{self.value}', [{self.start}:{self.end}])"


class BloodRequestNER:
    """
    Hybrid NER for blood request messages.

    Combines rule-based extraction (regex + gazetteers) with
    contextual disambiguation for high-precision entity extraction.
    """

    def __init__(self):
        """Initialize the NER extractor."""
        pass  # All patterns are pre-compiled in entity_rules.py

    def extract(self, text: str) -> dict:
        """
        Extract all entities from a blood request message.

        Args:
            text: Raw or cleaned message text.

        Returns:
            Dictionary with:
                - entities: List of Entity dicts (with spans)
                - summary: Flattened dict of extracted values per type
                - entity_count: Number of entities found
        """
        entities = []

        # Extract each entity type
        entities.extend(self._extract_blood_groups(text))
        entities.extend(self._extract_phones(text))
        entities.extend(self._extract_units(text))
        entities.extend(self._extract_hospitals(text))
        entities.extend(self._extract_cities(text))
        entities.extend(self._extract_conditions(text))
        entities.extend(self._extract_time_constraints(text))

        # Remove duplicate entities (same span)
        entities = self._deduplicate(entities)

        # Sort by position in text
        entities.sort(key=lambda e: e.start)

        # Build summary
        summary = {}
        for e in entities:
            key = e.type.lower()
            if key not in summary:
                summary[key] = []
            if e.value not in summary[key]:
                summary[key].append(e.value)

        return {
            'entities': [e.to_dict() for e in entities],
            'summary': summary,
            'entity_count': len(entities),
        }

    def extract_batch(self, texts: list) -> list:
        """Extract entities from a batch of messages."""
        return [self.extract(t) for t in texts]

    def annotate(self, text: str) -> str:
        """
        Return text with inline entity annotations for debugging.
        E.g., "Need [UNITS:3] units [BLOOD_GROUP:O-] at [HOSPITAL:AIIMS Delhi]"
        """
        result = self.extract(text)
        entities = sorted(result['entities'], key=lambda e: -e['start'])

        annotated = text
        for e in entities:
            tag = f"[{e['type']}:{e['value']}]"
            annotated = annotated[:e['start']] + tag + annotated[e['end']:]

        return annotated

    # ── Private Extraction Methods ──

    def _extract_blood_groups(self, text: str) -> list:
        entities = []
        for match in BLOOD_GROUP_PATTERN.finditer(text):
            raw = match.group(0)
            normalized = normalize_blood_group(raw)
            if normalized and normalized[-1] in '+-':
                entities.append(Entity(
                    'BLOOD_GROUP', normalized, raw,
                    match.start(), match.end(), confidence=0.95
                ))
        return entities

    def _extract_phones(self, text: str) -> list:
        entities = []
        for match in PHONE_PATTERN.finditer(text):
            phone = match.group(1) if match.group(1) else match.group(0)
            entities.append(Entity(
                'CONTACT', phone, match.group(0),
                match.start(), match.end(), confidence=0.90
            ))
        return entities

    def _extract_units(self, text: str) -> list:
        entities = []
        seen_positions = set()

        # Pattern 1: "3 units", "2 pints"
        for match in UNITS_PATTERN.finditer(text):
            units = int(match.group(1))
            if 1 <= units <= 20:  # Sanity check
                entities.append(Entity(
                    'UNITS_NEEDED', str(units), match.group(0),
                    match.start(), match.end(), confidence=0.90
                ))
                seen_positions.add(match.start())

        # Pattern 2: "3 O-" (number before blood group)
        for match in UNITS_BEFORE_BG.finditer(text):
            if match.start() not in seen_positions:
                units = int(match.group(1))
                if 1 <= units <= 20:
                    entities.append(Entity(
                        'UNITS_NEEDED', str(units), match.group(0),
                        match.start(), match.end(), confidence=0.80
                    ))

        return entities

    def _extract_hospitals(self, text: str) -> list:
        entities = []
        seen = set()
        for match in HOSPITAL_PATTERN.finditer(text):
            raw = match.group(0)
            # Normalize via gazetteer
            normalized = HOSPITALS.get(raw, None)
            if normalized is None:
                # Case-insensitive lookup
                for key, val in HOSPITALS.items():
                    if key.lower() == raw.lower():
                        normalized = val
                        break
                if normalized is None:
                    normalized = raw

            if normalized not in seen:
                seen.add(normalized)
                entities.append(Entity(
                    'HOSPITAL', normalized, raw,
                    match.start(), match.end(), confidence=0.85
                ))
        return entities

    def _extract_cities(self, text: str) -> list:
        entities = []
        seen = set()
        for match in CITY_PATTERN.finditer(text):
            raw = match.group(0)
            normalized = None
            for key, val in CITIES.items():
                if key.lower() == raw.lower():
                    normalized = val
                    break
            if normalized is None:
                normalized = raw

            # Skip if this city is part of a hospital name already extracted
            if normalized not in seen:
                seen.add(normalized)
                entities.append(Entity(
                    'LOCATION', normalized, raw,
                    match.start(), match.end(), confidence=0.85
                ))
        return entities

    def _extract_conditions(self, text: str) -> list:
        entities = []
        seen = set()
        for match in CONDITION_PATTERN.finditer(text):
            raw = match.group(0)
            normalized = None
            for key, val in CONDITION_KEYWORDS.items():
                if key.lower() == raw.lower():
                    normalized = val
                    break
            if normalized is None:
                normalized = raw.lower()

            if normalized not in seen:
                seen.add(normalized)
                entities.append(Entity(
                    'PATIENT_CONDITION', normalized, raw,
                    match.start(), match.end(), confidence=0.80
                ))
        return entities

    def _extract_time_constraints(self, text: str) -> list:
        entities = []
        seen = set()
        for pattern, default_val in TIME_PATTERNS:
            for match in pattern.finditer(text):
                raw = match.group(0)
                value = default_val if default_val else raw.lower()
                if value not in seen:
                    seen.add(value)
                    entities.append(Entity(
                        'TIME_CONSTRAINT', value, raw,
                        match.start(), match.end(), confidence=0.75
                    ))
        return entities

    def _deduplicate(self, entities: list) -> list:
        """Remove entities with overlapping spans, keeping higher confidence."""
        if not entities:
            return entities

        # Sort by confidence (descending)
        entities.sort(key=lambda e: -e.confidence)

        kept = []
        occupied = set()

        for e in entities:
            span = set(range(e.start, e.end))
            # Check if this span overlaps with any kept entity
            if not span & occupied:
                kept.append(e)
                occupied.update(span)

        return kept
