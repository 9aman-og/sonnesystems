#!/usr/bin/env python3
"""Repo health checks for sonnesystems.com. Run: python scripts/checks.py

Checks:
  1. No em dashes (or en dashes) in text files. House rule.
     Exception: lines containing a dash character class regex (Lyfe's Sol filter).
  2. Every local href/src in root html pages points at a file that exists.
  3. Encrypted papers carry the SSE1 magic header.

Exit code 0 = healthy, 1 = problems (printed).
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROBLEMS = []

TEXT_EXT = {".html", ".css", ".js", ".md", ".json", ".webmanifest", ".yml", ".yaml",
            ".py", ".ps1", ".txt", ".toml", ".cfg", ".ini", ""}
SKIP_DIRS = {".git", "__pycache__", ".pytest_cache", "node_modules", "data"}
SKIP_FILES = {"checks.py"}  # this file names the forbidden characters
DASH_ALLOW = "[—–]"  # a regex char class is the one legitimate use

EM = "—"
EN = "–"


def check_dashes():
    for p in ROOT.rglob("*"):
        if p.is_dir() or any(part in SKIP_DIRS for part in p.parts):
            continue
        if p.suffix.lower() not in TEXT_EXT or p.name in SKIP_FILES:
            continue
        try:
            text = p.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        for i, line in enumerate(text.splitlines(), 1):
            if DASH_ALLOW in line:
                continue
            if EM in line or EN in line:
                PROBLEMS.append(f"dash: {p.relative_to(ROOT)}:{i} contains an em/en dash")


LINK_RE = re.compile(r"""(?:href|src)=["']([^"']+)["']""")


def check_links():
    for page in ROOT.glob("*.html"):
        html = page.read_text(encoding="utf-8")
        for url in LINK_RE.findall(html):
            if url.startswith(("http://", "https://", "mailto:", "data:", "#", "tel:")):
                continue
            target = url.split("#")[0].split("?")[0]
            if not target:
                continue
            path = (ROOT / target.lstrip("/")) if target.startswith("/") else (page.parent / target)
            if target.endswith("/"):
                path = path / "index.html"
            if not path.exists():
                PROBLEMS.append(f"link: {page.name} references missing {url}")


def check_papers():
    papers = ROOT / "papers"
    if not papers.is_dir():
        PROBLEMS.append("papers: papers/ directory is missing")
        return
    for enc in papers.glob("*.enc"):
        with open(enc, "rb") as f:
            if f.read(4) != b"SSE1":
                PROBLEMS.append(f"papers: {enc.name} lacks the SSE1 header (not our format?)")


def main() -> int:
    check_dashes()
    check_links()
    check_papers()
    if PROBLEMS:
        print(f"FAIL: {len(PROBLEMS)} problem(s)")
        for p in PROBLEMS:
            print("  -", p)
        return 1
    print("OK: dashes clean, links resolve, papers encrypted")
    return 0


if __name__ == "__main__":
    sys.exit(main())
