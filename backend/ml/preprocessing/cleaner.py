"""
BloodBridge — Text Cleaner
===========================
Cleans and normalizes raw blood request messages from WhatsApp/Twitter/SMS.

Handles:
- Blood group normalization (O -ve → O-, AB positive → AB+)
- Phone number masking
- Emoji handling
- Excessive punctuation removal
- Common abbreviation expansion
- Unicode normalization
- Whitespace normalization
"""

import re
import unicodedata
from typing import Optional


class BloodRequestCleaner:
    """Clean and normalize blood request messages for downstream NLP models."""

    # ── Blood Group Patterns ──
    # Maps messy real-world blood group mentions to standardized form
    BLOOD_GROUP_PATTERNS = [
        # "AB negative", "AB -ve", "AB -", "AB−" → "AB- "
        (r'\b[Aa][Bb]\s*(?:[-\u2212\u2013]\s*(?:ve)?|[Nn]egative|[Nn]eg)\b', 'AB- '),
        (r'\b[Aa][Bb]\s*(?:\+\s*(?:ve)?|[Pp]ositive|[Pp]os)\b', 'AB+ '),
        # "O negative", "O -ve", "O -" → "O- "
        (r'\b[Oo]\s*(?:[-\u2212\u2013]\s*(?:ve)?|[Nn]egative|[Nn]eg)\b', 'O- '),
        (r'\b[Oo]\s*(?:\+\s*(?:ve)?|[Pp]ositive|[Pp]os)\b', 'O+ '),
        # "A negative", "A -ve" → "A- "
        (r'\b[Aa]\s*(?:[-\u2212\u2013]\s*(?:ve)?|[Nn]egative|[Nn]eg)\b', 'A- '),
        (r'\b[Aa]\s*(?:\+\s*(?:ve)?|[Pp]ositive|[Pp]os)\b', 'A+ '),
        # "B negative", "B -ve" → "B- "
        (r'\b[Bb]\s*(?:[-\u2212\u2013]\s*(?:ve)?|[Nn]egative|[Nn]eg)\b', 'B- '),
        (r'\b[Bb]\s*(?:\+\s*(?:ve)?|[Pp]ositive|[Pp]os)\b', 'B+ '),
    ]

    # ── Common Abbreviations in Blood Requests ──
    ABBREVIATIONS = {
        r'\bplz\b': 'please',
        r'\bpls\b': 'please',
        r'\bhlp\b': 'help',
        r'\bthnx\b': 'thanks',
        r'\bthx\b': 'thanks',
        r'\breqd\b': 'required',
        r'\bcontct\b': 'contact',
        r'\bcontkt\b': 'contact',
        r'\bimmdtly\b': 'immediately',
        r'\bimmediatly\b': 'immediately',
        r'\bpnt\b': 'patient',
        r'\bpt\b': 'patient',
        r'\bv\s+urgent\b': 'very urgent',
        r'\bhos?p(?:ital)?\b': 'hospital',
        r'\bblod\b': 'blood',
        r'\bbld\b': 'blood',
        r'\bdn(?:r|or)\b': 'donor',
        r'\bsrgry\b': 'surgery',
        r'\bopn\b': 'operation',
        r'\bICU\b': 'ICU',
    }

    # ── Emoji Categories ──
    # Medical/relevant emojis to preserve as text tokens
    MEDICAL_EMOJI_MAP = {
        '🆘': ' [SOS] ',
        '🩸': ' [BLOOD] ',
        '❗': ' [URGENT] ',
        '‼️': ' [URGENT] ',
        '⚠️': ' [WARNING] ',
        '☎️': ' [PHONE] ',
        '📞': ' [PHONE] ',
        '🏥': ' [HOSPITAL] ',
        '🚑': ' [AMBULANCE] ',
        '❤️': '',
        '🙏': '',
        '🙏🏻': '',
        '🙏🏽': '',
        '💉': ' [INJECTION] ',
    }

    # ── Indian Phone Number Pattern ──
    # Matches 10-digit Indian mobile numbers (starting with 6-9)
    PHONE_PATTERN = re.compile(
        r'(?:\+91[\s-]?)?(?:0)?([6-9]\d{9})\b'
    )

    # ── Hashtag Pattern ──
    HASHTAG_PATTERN = re.compile(r'#(\w+)')

    def __init__(self, expand_abbreviations: bool = True,
                 mask_phone_numbers: bool = True,
                 preserve_medical_emojis: bool = True):
        """
        Initialize the cleaner.

        Args:
            expand_abbreviations: Replace common abbreviations with full words.
            mask_phone_numbers: Replace phone numbers with [PHONE] token.
            preserve_medical_emojis: Convert medical emojis to text tokens
                                     instead of removing them entirely.
        """
        self.expand_abbreviations = expand_abbreviations
        self.mask_phone_numbers = mask_phone_numbers
        self.preserve_medical_emojis = preserve_medical_emojis

        # Pre-compile blood group patterns
        self._bg_patterns = [
            (re.compile(pattern), replacement)
            for pattern, replacement in self.BLOOD_GROUP_PATTERNS
        ]

        # Pre-compile abbreviation patterns
        self._abbr_patterns = [
            (re.compile(pattern, re.IGNORECASE), replacement)
            for pattern, replacement in self.ABBREVIATIONS.items()
        ]

    def clean(self, text: str) -> dict:
        """
        Clean a raw blood request message.

        Args:
            text: Raw message text (WhatsApp/Twitter/SMS).

        Returns:
            Dictionary with:
                - original: The unchanged input text
                - cleaned: The cleaned and normalized text
                - extracted_blood_groups: List of blood groups found
                - extracted_phones: List of phone numbers found (before masking)
                - extracted_hashtags: List of hashtags found
                - has_urgency_keywords: Whether urgency indicators were detected
                - message_length: Character count of cleaned text
                - word_count: Word count of cleaned text
        """
        original = text

        # Extract entities BEFORE cleaning (from raw text)
        blood_groups = self._extract_blood_groups(text)
        phones = self._extract_phones(text)
        hashtags = self._extract_hashtags(text)

        # ── Cleaning Pipeline (order matters!) ──
        text = self._normalize_unicode(text)
        text = self._handle_emojis(text)
        text = self._normalize_blood_groups(text)
        text = self._handle_hashtags(text)

        if self.mask_phone_numbers:
            text = self._mask_phones(text)

        if self.expand_abbreviations:
            text = self._expand_abbreviations(text)

        text = self._normalize_punctuation(text)
        text = self._normalize_whitespace(text)
        text = text.strip()

        return {
            'original': original,
            'cleaned': text,
            'extracted_blood_groups': blood_groups,
            'extracted_phones': phones,
            'extracted_hashtags': hashtags,
            'has_urgency_keywords': self._detect_urgency(text),
            'message_length': len(text),
            'word_count': len(text.split()),
        }

    # ── Private Methods ──

    def _normalize_unicode(self, text: str) -> str:
        """Normalize unicode characters (curly quotes, dashes, etc.)."""
        text = unicodedata.normalize('NFKC', text)
        # Normalize special dashes to standard hyphen
        text = text.replace('–', '-').replace('—', '-').replace('−', '-')
        # Normalize quotes
        text = text.replace('"', '"').replace('"', '"')
        text = text.replace(''', "'").replace(''', "'")
        return text

    def _handle_emojis(self, text: str) -> str:
        """Convert medical emojis to tokens, remove the rest."""
        if self.preserve_medical_emojis:
            for emoji, token in self.MEDICAL_EMOJI_MAP.items():
                text = text.replace(emoji, token)

        # Remove all remaining emojis
        emoji_pattern = re.compile(
            "["
            "\U0001F600-\U0001F64F"  # emoticons
            "\U0001F300-\U0001F5FF"  # symbols & pictographs
            "\U0001F680-\U0001F6FF"  # transport & map symbols
            "\U0001F1E0-\U0001F1FF"  # flags
            "\U00002702-\U000027B0"  # dingbats
            "\U000024C2-\U0001F251"  # enclosed characters
            "\U0001F900-\U0001F9FF"  # supplemental symbols
            "\U0001FA00-\U0001FA6F"  # chess symbols
            "\U0001FA70-\U0001FAFF"  # symbols extended
            "\U00002600-\U000026FF"  # misc symbols
            "]+",
            flags=re.UNICODE
        )
        text = emoji_pattern.sub(' ', text)
        return text

    def _normalize_blood_groups(self, text: str) -> str:
        """Normalize all blood group mentions to standard form (e.g., O-, AB+)."""
        for pattern, replacement in self._bg_patterns:
            text = pattern.sub(replacement, text)
        return text

    def _handle_hashtags(self, text: str) -> str:
        """Convert hashtags to regular words (e.g., #BloodNeeded → Blood Needed)."""
        def split_hashtag(match):
            tag = match.group(1)
            # Split CamelCase: BloodNeeded → Blood Needed
            words = re.sub(r'([a-z])([A-Z])', r'\1 \2', tag)
            return words

        return self.HASHTAG_PATTERN.sub(split_hashtag, text)

    def _mask_phones(self, text: str) -> str:
        """Replace phone numbers with [PHONE] token."""
        return self.PHONE_PATTERN.sub('[PHONE]', text)

    def _expand_abbreviations(self, text: str) -> str:
        """Expand common abbreviations found in blood request messages."""
        for pattern, replacement in self._abbr_patterns:
            text = pattern.sub(replacement, text)
        return text

    def _normalize_punctuation(self, text: str) -> str:
        """Reduce excessive punctuation while keeping meaningful ones."""
        text = re.sub(r'[!]{2,}', '!', text)
        text = re.sub(r'[?]{2,}', '?', text)
        text = re.sub(r'[.]{3,}', '...', text)
        text = re.sub(r'[-]{2,}', '-', text)
        text = re.sub(r'[*]{2,}', '', text)
        return text

    def _normalize_whitespace(self, text: str) -> str:
        """Collapse multiple spaces, remove leading/trailing whitespace."""
        text = re.sub(r'\s+', ' ', text)
        text = re.sub(r'\n+', ' ', text)
        text = re.sub(r'\r+', '', text)
        return text

    def _extract_blood_groups(self, text: str) -> list:
        """Extract all blood group mentions from raw text."""
        # Direct matches: "A+", "O-", "AB+", "AB-", "O+", "B-" etc.
        # Also catches forms like "O -", "AB +", with optional space
        direct = re.findall(
            r'\b((?:AB|A|B|O)\s*[+\-])(?:\s|\b|$)',
            text, re.IGNORECASE
        )

        # Wordy forms: "O negative", "B positive", "AB neg", "A pos"
        wordy = re.findall(
            r'\b((?:AB|A|B|O)\s*(?:positive|negative|pos|neg))\b',
            text, re.IGNORECASE
        )

        # "O NEGATIVE", "B+ ve" style
        ve_style = re.findall(
            r'\b((?:AB|A|B|O)\s*[+\-]\s*ve)\b',
            text, re.IGNORECASE
        )

        # Normalize all found groups
        all_found = direct + wordy + ve_style
        normalized = []
        for bg in all_found:
            bg_clean = bg.strip().upper()
            bg_clean = re.sub(r'\s+', '', bg_clean)
            bg_clean = bg_clean.replace('POSITIVE', '+').replace('NEGATIVE', '-')
            bg_clean = bg_clean.replace('POS', '+').replace('NEG', '-')
            bg_clean = bg_clean.replace('VE', '')
            # Ensure it ends with + or -
            if bg_clean and bg_clean[-1] in '+-':
                if bg_clean not in normalized:
                    normalized.append(bg_clean)

        return normalized

    def _extract_phones(self, text: str) -> list:
        """Extract all Indian phone numbers from text."""
        matches = self.PHONE_PATTERN.findall(text)
        return list(set(matches))

    def _extract_hashtags(self, text: str) -> list:
        """Extract all hashtags from text."""
        return self.HASHTAG_PATTERN.findall(text)

    def _detect_urgency(self, text: str) -> bool:
        """Check if text contains urgency indicators."""
        urgency_keywords = {
            'urgent', 'urgently', 'emergency', 'immediately', 'asap',
            'critical', 'critical condition', 'life threatening',
            'dying', 'hemorrhage', 'bleeding', 'accident',
            'sos', '[SOS]', '[URGENT]',
            # Hindi/Hinglish urgency words
            'turant', 'jaldi', 'zaruri', 'zarurat', 'emergency',
            'bahut zaruri', 'jaan ka khatra',
        }
        text_lower = text.lower()
        return any(kw in text_lower for kw in urgency_keywords)


def clean_batch(messages: list, cleaner: Optional[BloodRequestCleaner] = None) -> list:
    """
    Clean a batch of messages.

    Args:
        messages: List of raw message strings or dicts with 'message' key.
        cleaner: Optional pre-configured cleaner instance.

    Returns:
        List of cleaned message dictionaries.
    """
    if cleaner is None:
        cleaner = BloodRequestCleaner()

    results = []
    for msg in messages:
        text = msg if isinstance(msg, str) else msg.get('message', '')
        cleaned = cleaner.clean(text)

        # If input was a dict, merge the metadata
        if isinstance(msg, dict):
            cleaned['metadata'] = {
                k: v for k, v in msg.items() if k != 'message'
            }

        results.append(cleaned)

    return results
