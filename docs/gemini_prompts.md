# 🎯 Exact Prompts for Gemini Pro

> Run each prompt multiple times. Each run gives you 50 messages.
> 3 prompts × multiple runs × 50 messages = **~3,000 messages**

---

## How To Use

1. Open **Gemini Pro** (gemini.google.com)
2. Paste the prompt below
3. Copy the JSON output
4. Save it as `data/raw/batch_01.json`, `batch_02.json`, etc.
5. Repeat per prompt (change the batch number each time)

> **TIP**: After every 5 runs, slightly modify the prompt — change city names, add new hospitals, tweak the examples. This prevents repetition.

---

## PROMPT 1: Critical & High Urgency (English)

> Run this **20 times** → gives you ~1,000 P0 + P1 messages

```
You are a dataset generator for a machine learning project. Generate exactly 50 
realistic blood donation REQUEST messages as they would appear on Indian WhatsApp 
groups and Twitter.

STRICT RULES:
1. Output ONLY a valid JSON array. No explanation, no markdown, no extra text.
2. Each message must feel like a REAL person wrote it — include typos, 
   abbreviations (plz, pls, ASAP, hlp, thnx, reqd, contct), and informal grammar.
3. Vary the writing style: some panicked, some formal, some brief, some detailed.
4. 25 messages should be P0_CRITICAL (life-threatening, accident, hemorrhage, 
   rare blood group emergency, emergency surgery happening NOW)
5. 25 messages should be P1_HIGH (surgery scheduled soon, thalassemia patient, 
   cancer patient needing transfusion, urgent within hours)

REQUIRED FIELDS for each message:
- "message": The actual text (30-150 words, realistic WhatsApp/Twitter style)
- "urgency": "P0_CRITICAL" or "P1_HIGH"
- "blood_group": One of "O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"
- "hospital": Full hospital name with city
- "city": City name
- "units_needed": Number between 1-6
- "patient_condition": Brief condition (e.g., "road accident", "thalassemia", "liver surgery")
- "has_contact": true/false (whether message includes a phone number)
- "language": "english"

BLOOD GROUP DISTRIBUTION (follow this approximately):
O+ (36%), B+ (31%), A+ (22%), AB+ (6%), O- (2%), B- (1.5%), A- (1%), AB- (0.5%)
But for P0_CRITICAL, OVERREPRESENT rare groups (O-, B-, A-, AB-) since those 
create real emergencies.

USE THESE HOSPITALS (rotate through all):
AIIMS Delhi, Safdarjung Hospital Delhi, Apollo Hospital Chennai, 
Fortis Hospital Gurgaon, PGIMER Chandigarh, KEM Hospital Mumbai, 
Rajiv Gandhi Hospital Chennai, CMC Vellore, Narayana Health Bangalore,
Lilavati Hospital Mumbai, Max Hospital Saket Delhi, Medanta Gurgaon,
Ruby Hall Clinic Pune, KIMS Hyderabad, Manipal Hospital Bangalore,
Sir Ganga Ram Hospital Delhi, Breach Candy Hospital Mumbai,
Kokilaben Hospital Mumbai, Amrita Hospital Kochi, JIPMER Pondicherry

INCLUDE IN SOME MESSAGES:
- Fake phone numbers (98XXXXXXXX, 70XXXXXXXX, 88XXXXXXXX format)
- Emojis: 🙏 🆘 🩸 ❗ ☎️ (use in ~40% of messages)
- Hashtags: #BloodNeeded #BloodDonation #UrgentBlood (use in ~20%)
- "Please forward" / "Please share" / "Pls RT" (use in ~30%)

EXAMPLE OUTPUT FORMAT:
[
  {
    "message": "🆘 URGENT: My father met with severe accident on NH-44 near Delhi. Admitted in AIIMS trauma centre. Need 4 units O NEGATIVE blood IMMEDIATELY. He is in ICU losing blood fast. Anyone O- plz contact 9876543210. Please share in all groups 🙏🙏",
    "urgency": "P0_CRITICAL",
    "blood_group": "O-",
    "hospital": "AIIMS Delhi",
    "city": "Delhi",
    "units_needed": 4,
    "patient_condition": "road accident, hemorrhage",
    "has_contact": true,
    "language": "english"
  }
]

Generate 50 messages now. Output ONLY the JSON array.
```

---

## PROMPT 2: Moderate & Info (English)

> Run this **10 times** → gives you ~500 P2 + P3 messages

```
You are a dataset generator for a machine learning project. Generate exactly 50 
realistic blood-related messages as they would appear on Indian WhatsApp groups 
and Twitter.

STRICT RULES:
1. Output ONLY a valid JSON array. No explanation, no markdown, no extra text.
2. Each message must feel like a REAL person wrote it.
3. 25 messages should be P2_MODERATE (planned surgery in 2-5 days, scheduled 
   transfusion, patient stable but needs blood soon, common blood group)
4. 25 messages should be P3_INFO (blood donation camp announcements, donor 
   registration drives, awareness messages, thank you messages after donation, 
   general queries about blood donation eligibility, blood bank information)

REQUIRED FIELDS for each message:
- "message": The actual text (20-120 words)
- "urgency": "P2_MODERATE" or "P3_INFO"
- "blood_group": One of "O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-" 
  (for P3_INFO messages, use "NONE" if no specific blood group is mentioned)
- "hospital": Hospital name with city (for P3_INFO, can be "NONE" if not applicable)
- "city": City name
- "units_needed": Number (for P3_INFO, use 0)
- "patient_condition": Brief condition (for P3_INFO, use "general", "camp", "awareness")
- "has_contact": true/false
- "language": "english"

P2_MODERATE EXAMPLES:
- "My mother has surgery scheduled on Thursday at Fortis Gurgaon. Doctor asked 
   to arrange 2 units B+ blood. If anyone can donate please let me know."
- "Need A+ blood for a cancer patient at Tata Memorial Mumbai. Transfusion 
   scheduled for day after tomorrow. Please help if you can."

P3_INFO EXAMPLES:
- "Blood donation camp this Sunday at Rotary Club, Connaught Place, Delhi. 
   10am-4pm. Free health checkup for all donors! Please come and save lives."
- "Thank you to everyone who donated blood for my sister. She is recovering well. 
   You all are real heroes 🙏"
- "Can I donate blood if I had COVID 3 months ago? Anyone know the rules?"

USE HOSPITALS: Same variety (AIIMS, Apollo, Fortis, Max, Medanta, etc.)
USE CITIES: Delhi, Mumbai, Bangalore, Chennai, Kolkata, Hyderabad, Pune, Jaipur,
            Lucknow, Ahmedabad, Kochi, Chandigarh, Bhopal, Patna, Coimbatore

Generate 50 messages now. Output ONLY the JSON array.
```

---

## PROMPT 3: Hindi & Hinglish Messages

> Run this **20 times** → gives you ~1,000 multilingual messages

```
You are a dataset generator for a machine learning project. Generate exactly 50 
realistic blood donation request messages in HINDI and HINGLISH (code-mixed 
Hindi-English) as they would appear on Indian WhatsApp groups.

STRICT RULES:
1. Output ONLY a valid JSON array. No explanation, no markdown, no extra text.
2. Make messages feel AUTHENTIC — this is how real Indians text on WhatsApp.
3. LANGUAGE DISTRIBUTION:
   - 20 messages in PURE HINDI (Devanagari script)
   - 30 messages in HINGLISH (Roman script, mixing Hindi + English words)
4. URGENCY DISTRIBUTION:
   - 15 messages: P0_CRITICAL
   - 15 messages: P1_HIGH  
   - 10 messages: P2_MODERATE
   - 10 messages: P3_INFO

REQUIRED FIELDS:
- "message": The actual text in Hindi/Hinglish
- "message_english": English translation of the message
- "urgency": "P0_CRITICAL" / "P1_HIGH" / "P2_MODERATE" / "P3_INFO"
- "blood_group": "O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-", or "NONE"
- "hospital": Hospital name
- "city": City name
- "units_needed": Number
- "patient_condition": Brief condition in English
- "has_contact": true/false
- "language": "hindi" or "hinglish"

HINGLISH EXAMPLES (Roman script, mixed language):
- "Mere papa ka accident ho gaya hai NH-8 pe. AIIMS Delhi mein admitted hain. 
   3 unit O negative blood URGENTLY chahiye. Koi bhi O- donor ho toh please 
   contact karo 9876543210. Please sabko share karo 🙏🙏🆘"
- "Bhai kisi ko pata hai B+ blood kahan milega? Fortis Gurgaon mein surgery 
   hai kal. 2 unit chahiye. Help kar do please"
- "Blood donation camp hai is Sunday Lajpat Nagar mein. Aao aur blood donate 
   karo. Free health checkup bhi hai!"

HINDI EXAMPLES (Devanagari script):
- "🆘 ज़रूरी: मेरी बहन को तुरंत AB- खून चाहिए। सफदरजंग हॉस्पिटल में भर्ती हैं। 
   ऑपरेशन कल सुबह है। कोई भी AB negative डोनर हो तो कृपया संपर्क करें 9812345678"
- "मेरे दोस्त के पापा को B+ खून की ज़रूरत है। अपोलो हॉस्पिटल चेन्नई में भर्ती हैं। 
   2 यूनिट चाहिए। कृपया मदद करें 🙏"

COMMON HINGLISH WORDS TO USE:
chahiye, zaruri, please, urgent, hospital, blood, donate, contact, share, 
karo, help, unit, operation, accident, admitted, ICU, emergency, jaldi

USE HOSPITALS: AIIMS Delhi, Safdarjung, Apollo Chennai, Fortis Gurgaon,
PGIMER Chandigarh, KEM Mumbai, Max Saket, Medanta, Narayana Bangalore,
Sir Ganga Ram Delhi, Lilavati Mumbai, CMC Vellore, KIMS Hyderabad

Generate 50 messages now. Output ONLY the JSON array.
```

---

## Quick Reference

| Prompt | Urgency Levels | Language | Run X Times | Messages |
|--------|---------------|----------|-------------|----------|
| Prompt 1 | P0 + P1 | English | 20 times | ~1,000 |
| Prompt 2 | P2 + P3 | English | 10 times | ~500 |
| Prompt 3 | P0 + P1 + P2 + P3 | Hindi + Hinglish | 20 times | ~1,000 |
| | | **TOTAL** | **50 runs** | **~2,500** |
