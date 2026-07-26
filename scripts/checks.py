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
import json
import struct
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


def png_size(path: Path):
    data = path.read_bytes()[:24]
    if len(data) != 24 or data[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    return struct.unpack(">II", data[16:24])


def check_brand_and_indexing():
    expected_icons = {
        "favicon-32.png": (32, 32),
        "favicon-48.png": (48, 48),
        "apple-touch-icon.png": (180, 180),
        "icon-192.png": (192, 192),
        "icon-512.png": (512, 512),
    }
    for filename, dimensions in expected_icons.items():
        path = ROOT / filename
        if not path.exists():
            PROBLEMS.append(f"brand: {filename} is missing")
        elif png_size(path) != dimensions:
            PROBLEMS.append(f"brand: {filename} must be {dimensions[0]}x{dimensions[1]}")

    manifest_path = ROOT / "site.webmanifest"
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if manifest.get("name") != "Sonne Systems" or len(manifest.get("icons", [])) < 2:
            PROBLEMS.append("brand: site.webmanifest is incomplete")
    else:
        PROBLEMS.append("brand: site.webmanifest is missing")

    icon_marker = 'href="/favicon-48.png"'
    for filename in ("index.html", "research.html", "ventures.html", "about.html"):
        html = (ROOT / filename).read_text(encoding="utf-8")
        if icon_marker not in html or 'rel="apple-touch-icon"' not in html:
            PROBLEMS.append(f"brand: {filename} lacks shared browser icons")
        if 'name="robots" content="index, follow, max-image-preview:large"' not in html:
            PROBLEMS.append(f"indexing: {filename} lacks the public robots directive")

    home = (ROOT / "index.html").read_text(encoding="utf-8")
    if 'type="application/ld+json"' not in home or 'https://sonnesystems.com/#organization' not in home:
        PROBLEMS.append("indexing: homepage organization data is missing")

    robots = (ROOT / "robots.txt").read_text(encoding="utf-8")
    if "Allow: /" not in robots or "Sitemap: https://sonnesystems.com/sitemap.xml" not in robots:
        PROBLEMS.append("indexing: robots.txt does not expose the public site and sitemap")


def check_lyfe_shell():
    """Keep the published Lyfe entry point, PWA assets, and Sonne links intact."""
    lyfe = ROOT / "lyfe"
    required = {
        "index.html",
        "app.js",
        "cloud.js",
        "styles.css",
        "sw.js",
        "manifest.webmanifest",
    }
    for filename in sorted(required):
        if not (lyfe / filename).is_file():
            PROBLEMS.append(f"lyfe: {filename} is missing")

    manifest_path = lyfe / "manifest.webmanifest"
    if manifest_path.is_file():
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as error:
            PROBLEMS.append(f"lyfe: manifest is invalid JSON ({error})")
        else:
            for icon in manifest.get("icons", []):
                source = icon.get("src", "")
                if source and not (lyfe / source.lstrip("./")).is_file():
                    PROBLEMS.append(f"lyfe: manifest references missing {source}")

    ventures = (ROOT / "ventures.html").read_text(encoding="utf-8")
    if 'href="/lyfe/"' not in ventures:
        PROBLEMS.append("lyfe: Ventures page does not link to the live app")
    if "lyfe-feature-cloud" in ventures:
        PROBLEMS.append("lyfe: obsolete floating feature labels are present")


def main() -> int:
    check_dashes()
    check_links()
    check_papers()
    check_brand_and_indexing()
    check_lyfe_shell()
    if PROBLEMS:
        print(f"FAIL: {len(PROBLEMS)} problem(s)")
        for p in PROBLEMS:
            print("  -", p)
        return 1
    print("OK: links resolve, papers are encrypted, brand metadata and Lyfe shell are valid")
    return 0


if __name__ == "__main__":
    sys.exit(main())
