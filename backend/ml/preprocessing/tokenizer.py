"""
BloodBridge — Tokenizer Wrapper
=================================
Wraps HuggingFace tokenizers for transformer model input.
Pre-configured for MuRIL (Google's Multilingual Representations for Indian Languages).

Provides:
- Single message tokenization
- Batch tokenization with padding
- Token-to-text decoding for debugging
"""

from typing import Optional, Union
import torch


class BloodRequestTokenizer:
    """
    Tokenizer wrapper for blood request messages.

    Uses MuRIL tokenizer by default (handles 17 Indian languages + English).
    Falls back to a simple whitespace tokenizer if transformers is not available.
    """

    def __init__(self, model_name: str = "google/muril-base-cased",
                 max_length: int = 256,
                 use_fast: bool = True):
        """
        Initialize the tokenizer.

        Args:
            model_name: HuggingFace model name for the tokenizer.
            max_length: Maximum sequence length (tokens). MuRIL supports up to 512.
            use_fast: Use the fast Rust-based tokenizer if available.
        """
        self.model_name = model_name
        self.max_length = max_length
        self._tokenizer = None
        self._use_fast = use_fast
        self._is_loaded = False

    def _load_tokenizer(self):
        """Lazy-load the tokenizer (avoids loading at import time)."""
        if self._is_loaded:
            return

        try:
            from transformers import AutoTokenizer
            self._tokenizer = AutoTokenizer.from_pretrained(
                self.model_name,
                use_fast=self._use_fast
            )
            self._is_loaded = True
            print(f"[Tokenizer] Loaded: {self.model_name}")
        except ImportError:
            print("[Tokenizer] WARNING: transformers not installed. "
                  "Using simple whitespace tokenizer as fallback.")
            self._tokenizer = None
            self._is_loaded = True
        except Exception as e:
            print(f"[Tokenizer] WARNING: Could not load {self.model_name}: {e}")
            print("[Tokenizer] Using simple whitespace tokenizer as fallback.")
            self._tokenizer = None
            self._is_loaded = True

    def tokenize(self, text: str, return_tensors: Optional[str] = None) -> dict:
        """
        Tokenize a single message.

        Args:
            text: Cleaned message text.
            return_tensors: "pt" for PyTorch, "np" for NumPy, None for lists.

        Returns:
            Dictionary with:
                - input_ids: Token IDs
                - attention_mask: Attention mask (1 for real tokens, 0 for padding)
                - tokens: List of token strings (for debugging)
                - num_tokens: Number of tokens (excluding padding)
        """
        self._load_tokenizer()

        if self._tokenizer is not None:
            # Use HuggingFace tokenizer
            encoded = self._tokenizer(
                text,
                max_length=self.max_length,
                padding='max_length',
                truncation=True,
                return_tensors=return_tensors,
                return_attention_mask=True,
            )

            # Get token strings for debugging
            if return_tensors is None:
                token_ids = encoded['input_ids']
            else:
                token_ids = encoded['input_ids'].squeeze().tolist()

            tokens = self._tokenizer.convert_ids_to_tokens(
                token_ids[:self.max_length]
            )
            # Count non-padding tokens
            num_tokens = sum(
                1 for t in tokens
                if t != self._tokenizer.pad_token
            )

            return {
                'input_ids': encoded['input_ids'],
                'attention_mask': encoded['attention_mask'],
                'tokens': tokens,
                'num_tokens': num_tokens,
            }
        else:
            # Fallback: simple whitespace tokenizer
            return self._simple_tokenize(text)

    def tokenize_batch(self, texts: list,
                       return_tensors: Optional[str] = "pt") -> dict:
        """
        Tokenize a batch of messages with padding.

        Args:
            texts: List of cleaned message strings.
            return_tensors: "pt" for PyTorch tensors, "np" for NumPy arrays.

        Returns:
            Dictionary with batched input_ids and attention_mask.
        """
        self._load_tokenizer()

        if self._tokenizer is not None:
            encoded = self._tokenizer(
                texts,
                max_length=self.max_length,
                padding='max_length',
                truncation=True,
                return_tensors=return_tensors,
                return_attention_mask=True,
            )
            return {
                'input_ids': encoded['input_ids'],
                'attention_mask': encoded['attention_mask'],
                'batch_size': len(texts),
            }
        else:
            # Fallback for batch
            return {
                'tokenized': [self._simple_tokenize(t) for t in texts],
                'batch_size': len(texts),
            }

    def decode(self, token_ids: Union[list, 'torch.Tensor']) -> str:
        """Decode token IDs back to text."""
        self._load_tokenizer()

        if self._tokenizer is not None:
            if hasattr(token_ids, 'tolist'):
                token_ids = token_ids.tolist()
            return self._tokenizer.decode(token_ids, skip_special_tokens=True)
        else:
            return "[decode not available without transformers]"

    @property
    def vocab_size(self) -> int:
        """Return vocabulary size."""
        self._load_tokenizer()
        if self._tokenizer is not None:
            return self._tokenizer.vocab_size
        return 0

    @property
    def pad_token_id(self) -> int:
        """Return padding token ID."""
        self._load_tokenizer()
        if self._tokenizer is not None:
            return self._tokenizer.pad_token_id
        return 0

    # ── Private Methods ──

    def _simple_tokenize(self, text: str) -> dict:
        """Simple whitespace tokenizer as fallback."""
        import re
        tokens = re.findall(r'\b\w+\b|[^\w\s]', text.lower())
        tokens = tokens[:self.max_length]
        num_tokens = len(tokens)
        # Pad to max_length
        padded = tokens + ['[PAD]'] * (self.max_length - len(tokens))
        attention_mask = [1] * num_tokens + [0] * (self.max_length - num_tokens)

        return {
            'input_ids': list(range(len(padded))),  # Dummy IDs
            'attention_mask': attention_mask,
            'tokens': padded,
            'num_tokens': num_tokens,
        }
