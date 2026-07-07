# Security

## Reporting

Email **9aman.aa@gmail.com** with details. Please do not open a public issue for vulnerabilities.

## What is protected and how

- **Papers** (`papers/*.pdf.enc`): AES-256-GCM, key derived from a password via PBKDF2-HMAC-SHA256
  (310,000 iterations, random 16-byte salt, random 12-byte IV, format `SSE1|salt|iv|ct||tag`).
  Decryption happens in the visitor's browser via Web Crypto. The ciphertext being public is safe;
  the password is shared out-of-band by the author.
- **Backend passwords**: never stored in plaintext; PBKDF2-HMAC-SHA256 with per-user salt.
- **Backend tokens**: 256-bit random, stored hashed (SHA-256), expiring.
- **No secrets in the repo**: CI and code review enforce it. `.db` files and local data are gitignored.

## Credentials policy (for everyone who works on this)

- Never share or request account passwords or OTP codes, including in chats with AI assistants.
- GitHub access: personal accounts + repo permissions, `gh auth login --web`.
- Domain/DNS: owner-only, or a scoped API key that can be revoked.
- Rotate the paper password by re-running `scripts/encrypt_paper.py` with a new password and
  committing the new `.enc` files.
