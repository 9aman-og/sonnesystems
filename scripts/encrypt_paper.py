#!/usr/bin/env python3
"""Encrypt a paper PDF for the papers.html gate.

Usage:
    python scripts/encrypt_paper.py <input.pdf> <output.pdf.enc> <password>

Format (matches papers.html): b"SSE1" | salt(16) | iv(12) | AES-256-GCM ciphertext||tag
Key: PBKDF2-HMAC-SHA256, 310,000 iterations. Requires: pip install cryptography
"""
import hashlib
import os
import sys

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ITERATIONS = 310_000


def encrypt(in_path: str, out_path: str, password: str) -> None:
    data = open(in_path, "rb").read()
    salt, iv = os.urandom(16), os.urandom(12)
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, ITERATIONS, dklen=32)
    ct = AESGCM(key).encrypt(iv, data, None)  # ciphertext||tag
    blob = b"SSE1" + salt + iv + ct
    open(out_path, "wb").write(blob)

    # round-trip self-test so a bad write can never ship
    raw = open(out_path, "rb").read()
    assert raw[:4] == b"SSE1"
    k2 = hashlib.pbkdf2_hmac("sha256", password.encode(), raw[4:20], ITERATIONS, dklen=32)
    assert AESGCM(k2).decrypt(raw[20:32], raw[32:], None) == data, "round trip mismatch"
    print(f"ok: {out_path}  plain={len(data)}b enc={len(blob)}b  round-trip verified")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(2)
    encrypt(sys.argv[1], sys.argv[2], sys.argv[3])
