"""
BloodBridge — Language Detector
================================
Detects language of blood request messages.
Handles English, Hindi (Devanagari), and Hinglish (code-mixed).

Uses a layered approach:
  1. Script-based detection (Devanagari → Hindi)
  2. Code-mixing ratio analysis (Hinglish detection)
  3. Keyword-based fallback
"""

import re
from enum import Enum
from typing import Optional


class Language(str, Enum):
    """Supported languages for blood request messages."""
    ENGLISH = "english"
    HINDI = "hindi"
    HINGLISH = "hinglish"
    UNKNOWN = "unknown"


class LanguageDetector:
    """
    Detect language of blood request messages.

    Uses script analysis and keyword matching rather than heavy ML models,
    since our domain is narrow (blood requests in Indian languages).
    """

    # Unicode range for Devanagari script
    DEVANAGARI_PATTERN = re.compile(r'[\u0900-\u097F]')

    # Common Hindi words written in Roman script (Hinglish indicators)
    HINGLISH_MARKERS = {
        # Common verbs/auxiliaries
        'hai', 'hain', 'ho', 'tha', 'thi', 'the',
        'karo', 'kare', 'karna', 'kiya', 'kar',
        'chahiye', 'chahie', 'chaiye', 'chiye',
        'dena', 'dedo', 'do', 'dijiye', 'dein',
        'lena', 'lelo', 'lejao', 'le',
        'raha', 'rahi', 'rahe',
        'hoga', 'hogi', 'honge',
        # Common nouns
        'bhai', 'behen', 'didi', 'papa', 'mummy', 'maa',
        'beta', 'baccha', 'dost', 'yaar',
        'khoon', 'khun', 'lahu',
        'aspatal', 'davakhana',
        # Common adjectives/adverbs
        'bahut', 'bohot', 'boht',
        'jaldi', 'turant', 'foran',
        'zaruri', 'zarurat', 'zaroori', 'jaroori',
        'mushkil', 'pareshani',
        # Common particles
        'mein', 'mei', 'me',
        'ko', 'ka', 'ki', 'ke',
        'se', 'pe', 'par',
        'aur', 'ya', 'lekin',
        'koi', 'kisi', 'kuch',
        'yahan', 'wahan', 'kahan',
        'abhi', 'kal', 'aaj',
        # Hinglish request phrases
        'madad', 'sahayata', 'seva',
        'sampark', 'contact', 'sambandh',
        'kripa', 'kripya', 'krpya',
        # Common Hinglish sentence patterns
        'nahi', 'nahin', 'nhi',
        'sabko', 'sab', 'sabhi',
        'bohot', 'bhot',
        'meri', 'mera', 'mere',
        'unka', 'unki', 'unke',
        'iska', 'iski', 'iske',
    }

    # Common English medical/blood request words
    ENGLISH_MARKERS = {
        'blood', 'urgent', 'emergency', 'hospital', 'patient',
        'donate', 'donation', 'donor', 'units', 'needed',
        'required', 'surgery', 'accident', 'please', 'help',
        'contact', 'immediately', 'critical', 'condition',
        'transfusion', 'available', 'looking', 'anyone',
        'share', 'forward', 'family', 'admitted', 'icu',
    }

    def __init__(self, hinglish_threshold: float = 0.15):
        """
        Initialize the language detector.

        Args:
            hinglish_threshold: Minimum ratio of Hindi words in a Roman-script
                                message to classify it as Hinglish (default 0.15 = 15%).
        """
        self.hinglish_threshold = hinglish_threshold

    def detect(self, text: str) -> dict:
        """
        Detect the language of a blood request message.

        Args:
            text: The message text.

        Returns:
            Dictionary with:
                - language: Detected language (Language enum value)
                - confidence: Confidence score (0.0 to 1.0)
                - devanagari_ratio: Ratio of Devanagari characters
                - hinglish_word_ratio: Ratio of Hindi words in Roman script
                - script: Primary script detected ("devanagari", "latin", "mixed")
        """
        if not text or not text.strip():
            return self._result(Language.UNKNOWN, 0.0, 0.0, 0.0, "none")

        # Count Devanagari vs Latin characters
        devanagari_chars = len(self.DEVANAGARI_PATTERN.findall(text))
        alpha_chars = sum(1 for c in text if c.isalpha())

        if alpha_chars == 0:
            return self._result(Language.UNKNOWN, 0.0, 0.0, 0.0, "none")

        devanagari_ratio = devanagari_chars / alpha_chars

        # ── Decision Logic ──

        # Case 1: Predominantly Devanagari → Hindi
        if devanagari_ratio > 0.5:
            confidence = min(devanagari_ratio + 0.2, 1.0)
            script = "devanagari" if devanagari_ratio > 0.8 else "mixed"
            return self._result(Language.HINDI, confidence, devanagari_ratio, 0.0, script)

        # Case 2: Mixed scripts → Hinglish (Devanagari + Latin)
        if 0.1 < devanagari_ratio <= 0.5:
            return self._result(Language.HINGLISH, 0.85, devanagari_ratio, 0.0, "mixed")

        # Case 3: All Latin script → check for Hinglish words
        words = self._tokenize_simple(text)
        if not words:
            return self._result(Language.UNKNOWN, 0.0, 0.0, 0.0, "none")

        hindi_word_count = sum(1 for w in words if w in self.HINGLISH_MARKERS)
        english_word_count = sum(1 for w in words if w in self.ENGLISH_MARKERS)
        hinglish_ratio = hindi_word_count / len(words)

        # Case 3a: Significant Hindi words in Roman script → Hinglish
        if hinglish_ratio >= self.hinglish_threshold:
            confidence = min(0.6 + hinglish_ratio, 1.0)
            return self._result(Language.HINGLISH, confidence, devanagari_ratio,
                                hinglish_ratio, "latin")

        # Case 3b: Default → English
        confidence = min(0.7 + (english_word_count / max(len(words), 1)) * 0.3, 1.0)
        return self._result(Language.ENGLISH, confidence, devanagari_ratio,
                            hinglish_ratio, "latin")

    def detect_language(self, text: str) -> str:
        """Convenience method: returns just the language string."""
        return self.detect(text)['language']

    # ── Private Methods ──

    def _tokenize_simple(self, text: str) -> list:
        """Simple whitespace + punctuation tokenizer for language detection."""
        # Remove punctuation and digits, lowercase
        text = re.sub(r'[^\w\s]', ' ', text.lower())
        text = re.sub(r'\d+', '', text)
        words = [w for w in text.split() if len(w) > 1]
        return words

    def _result(self, language: Language, confidence: float,
                devanagari_ratio: float, hinglish_ratio: float,
                script: str) -> dict:
        """Build a result dictionary."""
        return {
            'language': language.value,
            'confidence': round(confidence, 3),
            'devanagari_ratio': round(devanagari_ratio, 3),
            'hinglish_word_ratio': round(hinglish_ratio, 3),
            'script': script,
        }
