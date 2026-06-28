"""
BloodBridge — Entity Rules & Gazetteers
=========================================
Domain-specific patterns and dictionaries for blood request NER.
"""

import re

# ══════════════════════════════════════════════════════════
# BLOOD GROUP PATTERNS
# ══════════════════════════════════════════════════════════

BLOOD_GROUP_PATTERN = re.compile(
    r'\b('
    r'(?:AB|A|B|O)\s*(?:[+\-])\s*(?:ve)?'   # O+, AB-, B+ve, A -ve
    r'|(?:AB|A|B|O)\s*(?:positive|negative|pos|neg)'  # O negative, AB positive
    r')\b',
    re.IGNORECASE
)

def normalize_blood_group(raw: str) -> str:
    """Normalize any blood group mention to standard form (e.g., O-, AB+)."""
    bg = raw.strip().upper()
    bg = re.sub(r'\s+', '', bg)
    bg = bg.replace('POSITIVE', '+').replace('NEGATIVE', '-')
    bg = bg.replace('POS', '+').replace('NEG', '-')
    bg = bg.replace('VE', '')
    return bg


# ══════════════════════════════════════════════════════════
# PHONE NUMBER PATTERN
# ══════════════════════════════════════════════════════════

PHONE_PATTERN = re.compile(
    r'(?:\+91[\s\-]?)?(?:0)?([6-9]\d{9})\b'
)


# ══════════════════════════════════════════════════════════
# UNITS NEEDED PATTERN
# ══════════════════════════════════════════════════════════

UNITS_PATTERN = re.compile(
    r'(\d{1,2})\s*(?:units?|pints?|bottles?|bags?)\b',
    re.IGNORECASE
)

# Also catches "need 3 O-" style (number before blood group)
UNITS_BEFORE_BG = re.compile(
    r'(\d{1,2})\s*(?:units?\s+(?:of\s+)?)?(?:AB|A|B|O)\s*[+\-]',
    re.IGNORECASE
)


# ══════════════════════════════════════════════════════════
# HOSPITAL GAZETTEER (Indian hospitals)
# ══════════════════════════════════════════════════════════

HOSPITALS = {
    # Delhi NCR
    "AIIMS": "AIIMS Delhi",
    "AIIMS Delhi": "AIIMS Delhi",
    "Safdarjung": "Safdarjung Hospital Delhi",
    "Safdarjung Hospital": "Safdarjung Hospital Delhi",
    "Sir Ganga Ram": "Sir Ganga Ram Hospital Delhi",
    "Ganga Ram": "Sir Ganga Ram Hospital Delhi",
    "Max Saket": "Max Hospital Saket Delhi",
    "Max Hospital": "Max Hospital Delhi",
    "Fortis Gurgaon": "Fortis Hospital Gurgaon",
    "Fortis Hospital Gurgaon": "Fortis Hospital Gurgaon",
    "Fortis Hospital Gurugram": "Fortis Hospital Gurgaon",
    "Medanta": "Medanta Gurgaon",
    "Medanta Gurgaon": "Medanta Gurgaon",
    "Medanta Gurugram": "Medanta Gurgaon",
    "BLK Hospital": "BLK Hospital Delhi",
    "RML Hospital": "RML Hospital Delhi",
    "GTB Hospital": "GTB Hospital Delhi",
    # Mumbai
    "KEM Hospital": "KEM Hospital Mumbai",
    "KEM Mumbai": "KEM Hospital Mumbai",
    "Lilavati": "Lilavati Hospital Mumbai",
    "Lilavati Hospital": "Lilavati Hospital Mumbai",
    "Breach Candy": "Breach Candy Hospital Mumbai",
    "Kokilaben": "Kokilaben Hospital Mumbai",
    "Kokilaben Hospital": "Kokilaben Hospital Mumbai",
    "Tata Memorial": "Tata Memorial Hospital Mumbai",
    "Hinduja Hospital": "Hinduja Hospital Mumbai",
    "Jaslok Hospital": "Jaslok Hospital Mumbai",
    # Chennai
    "Apollo Chennai": "Apollo Hospital Chennai",
    "Apollo Hospital Chennai": "Apollo Hospital Chennai",
    "Rajiv Gandhi Hospital": "Rajiv Gandhi Hospital Chennai",
    "CMC Vellore": "CMC Vellore",
    "JIPMER": "JIPMER Pondicherry",
    # Bangalore
    "Narayana Health": "Narayana Health Bangalore",
    "Narayana Hospital": "Narayana Health Bangalore",
    "Manipal Hospital": "Manipal Hospital Bangalore",
    "Manipal Hospital Bangalore": "Manipal Hospital Bangalore",
    # Hyderabad
    "KIMS Hyderabad": "KIMS Hyderabad",
    "KIMS Hospital": "KIMS Hyderabad",
    "Yashoda Hospital": "Yashoda Hospital Hyderabad",
    "NIMS Hyderabad": "NIMS Hyderabad",
    # Chandigarh
    "PGIMER": "PGIMER Chandigarh",
    "PGIMER Chandigarh": "PGIMER Chandigarh",
    "PGI Chandigarh": "PGIMER Chandigarh",
    # Pune
    "Ruby Hall": "Ruby Hall Clinic Pune",
    "Ruby Hall Clinic": "Ruby Hall Clinic Pune",
    "Sassoon Hospital": "Sassoon Hospital Pune",
    # Kolkata
    "SSKM Hospital": "SSKM Hospital Kolkata",
    "Apollo Kolkata": "Apollo Hospital Kolkata",
    # Kochi
    "Amrita Hospital": "Amrita Hospital Kochi",
    "Amrita Hospital Kochi": "Amrita Hospital Kochi",
    # Generic chains (match with city context)
    "Apollo Hospital": "Apollo Hospital",
    "Fortis Hospital": "Fortis Hospital",
    "Max Hospital Saket": "Max Hospital Saket Delhi",
}

# Build regex from gazetteer (longest match first to avoid partial matches)
_hospital_names = sorted(HOSPITALS.keys(), key=len, reverse=True)
_hospital_escaped = [re.escape(h) for h in _hospital_names]
HOSPITAL_PATTERN = re.compile(
    r'\b(' + '|'.join(_hospital_escaped) + r')\b',
    re.IGNORECASE
)


# ══════════════════════════════════════════════════════════
# CITY GAZETTEER
# ══════════════════════════════════════════════════════════

CITIES = {
    "Delhi": "Delhi", "New Delhi": "Delhi", "NCR": "Delhi",
    "Mumbai": "Mumbai", "Bombay": "Mumbai",
    "Bangalore": "Bangalore", "Bengaluru": "Bangalore",
    "Chennai": "Chennai", "Madras": "Chennai",
    "Kolkata": "Kolkata", "Calcutta": "Kolkata",
    "Hyderabad": "Hyderabad",
    "Pune": "Pune",
    "Jaipur": "Jaipur",
    "Lucknow": "Lucknow",
    "Chandigarh": "Chandigarh",
    "Gurgaon": "Gurgaon", "Gurugram": "Gurgaon",
    "Noida": "Noida",
    "Kochi": "Kochi", "Cochin": "Kochi",
    "Ahmedabad": "Ahmedabad",
    "Bhopal": "Bhopal",
    "Patna": "Patna",
    "Coimbatore": "Coimbatore",
    "Vellore": "Vellore",
    "Pondicherry": "Pondicherry", "Puducherry": "Pondicherry",
    "Indore": "Indore",
    "Nagpur": "Nagpur",
    "Thiruvananthapuram": "Thiruvananthapuram",
    "Visakhapatnam": "Visakhapatnam", "Vizag": "Visakhapatnam",
}

_city_names = sorted(CITIES.keys(), key=len, reverse=True)
CITY_PATTERN = re.compile(
    r'\b(' + '|'.join(re.escape(c) for c in _city_names) + r')\b',
    re.IGNORECASE
)


# ══════════════════════════════════════════════════════════
# PATIENT CONDITION PATTERNS
# ══════════════════════════════════════════════════════════

CONDITION_KEYWORDS = {
    # Trauma
    "accident": "accident", "road accident": "road accident",
    "car crash": "car crash", "car accident": "car accident",
    "truck accident": "truck accident", "bike accident": "bike accident",
    "hit and run": "hit and run", "collision": "collision",
    "trauma": "trauma", "fall": "fall", "injury": "injury",
    "burn": "burns", "burns": "burns", "fire": "burns",
    "blast": "blast injury", "gunshot": "gunshot",
    "snake bite": "snake bite", "stabbing": "stabbing",
    # Surgery
    "surgery": "surgery", "operation": "surgery",
    "bypass": "bypass surgery", "bypass surgery": "bypass surgery",
    "open heart": "open heart surgery",
    "knee replacement": "knee replacement",
    "transplant": "transplant", "liver transplant": "liver transplant",
    "kidney transplant": "kidney transplant",
    "c-section": "cesarean section", "cesarean": "cesarean section",
    # Blood disorders
    "thalassemia": "thalassemia", "thalassaemia": "thalassemia",
    "sickle cell": "sickle cell disease",
    "hemophilia": "hemophilia", "haemophilia": "hemophilia",
    "leukemia": "leukemia", "leukaemia": "leukemia",
    "anemia": "anemia", "anaemia": "anemia",
    # Other
    "cancer": "cancer", "tumor": "cancer", "tumour": "cancer",
    "hemorrhage": "hemorrhage", "haemorrhage": "hemorrhage",
    "bleeding": "bleeding", "blood loss": "blood loss",
    "postpartum": "postpartum hemorrhage",
    "dengue": "dengue", "malaria": "malaria",
    "dialysis": "dialysis", "chemotherapy": "chemotherapy",
    "transfusion": "transfusion",
    "aneurysm": "aneurysm",
    "delivery": "delivery", "pregnancy": "pregnancy complications",
}

_cond_keys = sorted(CONDITION_KEYWORDS.keys(), key=len, reverse=True)
CONDITION_PATTERN = re.compile(
    r'\b(' + '|'.join(re.escape(c) for c in _cond_keys) + r')\b',
    re.IGNORECASE
)


# ══════════════════════════════════════════════════════════
# TIME CONSTRAINT PATTERNS
# ══════════════════════════════════════════════════════════

TIME_PATTERNS = [
    (re.compile(r'\b(immediately|right now|right away|asap|urgent(?:ly)?)\b', re.I), "IMMEDIATE"),
    (re.compile(r'\b(within\s+\d+\s+hours?)\b', re.I), None),  # captures actual text
    (re.compile(r'\b(today|tonight|this evening|this morning)\b', re.I), "TODAY"),
    (re.compile(r'\b(tomorrow|kal|next day)\b', re.I), "TOMORROW"),
    (re.compile(r'\b(this week|next week|in \d+ days?)\b', re.I), "THIS_WEEK"),
    (re.compile(r'\b((?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b', re.I), None),
]
