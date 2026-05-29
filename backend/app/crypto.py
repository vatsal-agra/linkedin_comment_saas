"""Symmetric encryption for user API keys (Fernet / AES-128-CBC + HMAC).

The master key comes from the environment and is NEVER written to disk by the
app. Encrypted values are what we store in the database, so a stolen DB file or
disk snapshot reveals nothing without the master key.
"""
from __future__ import annotations

from cryptography.fernet import Fernet, InvalidToken

from app import config

_fernet: Fernet | None = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        if not config.MASTER_ENCRYPTION_KEY:
            raise RuntimeError("MASTER_ENCRYPTION_KEY is not set")
        _fernet = Fernet(config.MASTER_ENCRYPTION_KEY.encode())
    return _fernet


def encrypt(plaintext: str) -> str:
    """Encrypt a secret for storage. Empty string stays empty."""
    if not plaintext:
        return ""
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt(token: str) -> str:
    """Decrypt a stored secret. Returns '' on empty or undecryptable input."""
    if not token:
        return ""
    try:
        return _get_fernet().decrypt(token.encode()).decode()
    except InvalidToken:
        # Master key changed or data corrupted — treat as "no key set".
        return ""
