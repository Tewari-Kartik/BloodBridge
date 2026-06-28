"""
BloodBridge — Preprocessing Pipeline
======================================
Chains all preprocessing stages into a single pipeline:

    Raw Message → Clean → Detect Language → Tokenize → Ready for Models

Usage:
    from backend.ml.preprocessing.pipeline import PreprocessingPipeline

    pipeline = PreprocessingPipeline()
    result = pipeline.process("Need O- blood at AIIMS Delhi urgently!")
    print(result)
"""

import json
import os
import time
from typing import Optional

from backend.ml.preprocessing.cleaner import BloodRequestCleaner
from backend.ml.preprocessing.language_detect import LanguageDetector
from backend.ml.preprocessing.tokenizer import BloodRequestTokenizer


class PreprocessingPipeline:
    """
    End-to-end preprocessing pipeline for blood request messages.

    Orchestrates: Text Cleaning → Language Detection → Tokenization
    """

    def __init__(self, tokenizer_model: str = "google/muril-base-cased",
                 max_length: int = 256,
                 expand_abbreviations: bool = True,
                 mask_phone_numbers: bool = True,
                 skip_tokenization: bool = False):
        """
        Initialize the preprocessing pipeline.

        Args:
            tokenizer_model: HuggingFace model name for tokenization.
            max_length: Maximum token sequence length.
            expand_abbreviations: Expand abbreviations in cleaner.
            mask_phone_numbers: Mask phone numbers in cleaner.
            skip_tokenization: If True, skip the tokenization step
                               (useful when you just want clean text).
        """
        self.cleaner = BloodRequestCleaner(
            expand_abbreviations=expand_abbreviations,
            mask_phone_numbers=mask_phone_numbers,
            preserve_medical_emojis=True,
        )
        self.language_detector = LanguageDetector()
        self.skip_tokenization = skip_tokenization

        if not skip_tokenization:
            self.tokenizer = BloodRequestTokenizer(
                model_name=tokenizer_model,
                max_length=max_length,
            )
        else:
            self.tokenizer = None

    def process(self, text: str, include_tokens: bool = False) -> dict:
        """
        Process a single blood request message through the full pipeline.

        Args:
            text: Raw message text.
            include_tokens: If True, include token-level details in output.

        Returns:
            Dictionary with all preprocessing results:
                - original: Original text
                - cleaned: Cleaned text
                - language: Detected language info
                - extracted: Pre-extracted entities (blood groups, phones, etc.)
                - tokens: Tokenization output (if include_tokens=True)
                - processing_time_ms: Time taken in milliseconds
        """
        start = time.perf_counter()

        # Stage 1: Clean
        cleaned = self.cleaner.clean(text)

        # Stage 2: Detect Language
        lang_info = self.language_detector.detect(text)

        # Stage 3: Tokenize (optional)
        token_info = None
        if not self.skip_tokenization and include_tokens:
            token_info = self.tokenizer.tokenize(cleaned['cleaned'])
            # Remove the full token list to keep output manageable
            token_info = {
                'num_tokens': token_info['num_tokens'],
                'first_10_tokens': token_info['tokens'][:10],
            }

        elapsed_ms = (time.perf_counter() - start) * 1000

        return {
            'original': cleaned['original'],
            'cleaned': cleaned['cleaned'],
            'language': lang_info,
            'extracted': {
                'blood_groups': cleaned['extracted_blood_groups'],
                'phones': cleaned['extracted_phones'],
                'hashtags': cleaned['extracted_hashtags'],
                'has_urgency_keywords': cleaned['has_urgency_keywords'],
            },
            'stats': {
                'message_length': cleaned['message_length'],
                'word_count': cleaned['word_count'],
            },
            'tokens': token_info,
            'processing_time_ms': round(elapsed_ms, 2),
        }

    def process_batch(self, messages: list, verbose: bool = False) -> list:
        """
        Process a batch of messages.

        Args:
            messages: List of raw message strings or dicts with 'message' key.
            verbose: Print progress every 100 messages.

        Returns:
            List of processed message dictionaries.
        """
        results = []
        total = len(messages)

        for i, msg in enumerate(messages):
            text = msg if isinstance(msg, str) else msg.get('message', '')
            result = self.process(text, include_tokens=False)

            # Carry over any metadata from input
            if isinstance(msg, dict):
                result['metadata'] = {
                    k: v for k, v in msg.items() if k != 'message'
                }

            results.append(result)

            if verbose and (i + 1) % 100 == 0:
                print(f"  Processed {i + 1}/{total} messages...")

        if verbose:
            print(f"  Done! Processed {total} messages total.")

        return results

    def process_file(self, input_path: str, output_path: str,
                     verbose: bool = True) -> dict:
        """
        Process all messages from a JSON file and save results.

        Args:
            input_path: Path to input JSON file (list of message objects).
            output_path: Path to save processed output JSON.
            verbose: Print progress.

        Returns:
            Summary statistics dictionary.
        """
        # Load
        with open(input_path, 'r', encoding='utf-8') as f:
            messages = json.load(f)

        if verbose:
            print(f"Loaded {len(messages)} messages from {input_path}")

        # Process
        start = time.perf_counter()
        results = self.process_batch(messages, verbose=verbose)
        total_time = time.perf_counter() - start

        # Save
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)

        # Compute summary stats
        from collections import Counter
        lang_dist = Counter(r['language']['language'] for r in results)
        urgency_detected = sum(1 for r in results if r['extracted']['has_urgency_keywords'])
        bg_found = sum(1 for r in results if r['extracted']['blood_groups'])
        avg_length = sum(r['stats']['word_count'] for r in results) / len(results)
        avg_time = sum(r['processing_time_ms'] for r in results) / len(results)

        summary = {
            'total_messages': len(results),
            'language_distribution': dict(lang_dist),
            'urgency_keywords_detected': urgency_detected,
            'blood_groups_found': bg_found,
            'avg_word_count': round(avg_length, 1),
            'avg_processing_time_ms': round(avg_time, 3),
            'total_processing_time_s': round(total_time, 2),
            'output_file': output_path,
        }

        if verbose:
            print(f"\n{'=' * 50}")
            print("PREPROCESSING SUMMARY")
            print(f"{'=' * 50}")
            for key, value in summary.items():
                print(f"  {key}: {value}")

        return summary
