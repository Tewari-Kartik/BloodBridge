"""
BloodBridge — Blood Group Compatibility
=========================================
Medical rules for blood transfusion compatibility.
"""

# Recipient → Set of compatible donor blood groups
COMPATIBILITY = {
    'O-':  {'O-'},
    'O+':  {'O-', 'O+'},
    'A-':  {'O-', 'A-'},
    'A+':  {'O-', 'O+', 'A-', 'A+'},
    'B-':  {'O-', 'B-'},
    'B+':  {'O-', 'O+', 'B-', 'B+'},
    'AB-': {'O-', 'A-', 'B-', 'AB-'},
    'AB+': {'O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'},
}

# Rarity index (higher = rarer in India)
RARITY = {
    'O+': 0.1, 'B+': 0.15, 'A+': 0.2, 'AB+': 0.4,
    'O-': 0.7, 'B-': 0.8, 'A-': 0.85, 'AB-': 0.95,
}

# Minimum days between donations (Indian guidelines)
MIN_DONATION_GAP_DAYS = 90


def is_compatible(donor_bg: str, recipient_bg: str) -> bool:
    """Check if donor can donate to recipient."""
    compatible_donors = COMPATIBILITY.get(recipient_bg, set())
    return donor_bg in compatible_donors


def get_compatible_donors(recipient_bg: str) -> set:
    """Get set of blood groups that can donate to this recipient."""
    return COMPATIBILITY.get(recipient_bg, set())


def is_eligible(last_donation_days: int) -> bool:
    """Check if donor has waited long enough since last donation."""
    return last_donation_days >= MIN_DONATION_GAP_DAYS


def is_exact_match(donor_bg: str, recipient_bg: str) -> bool:
    """Check if blood groups match exactly (preferred over compatible)."""
    return donor_bg == recipient_bg
