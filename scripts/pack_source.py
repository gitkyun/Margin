"""Create a portable source snapshot without credentials, data, or generated files."""
from __future__ import annotations

import hashlib
import json
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT.parent / "인계_2026-11-05"
ARCHIVE = OUTPUT / "RMS_source_2026-11-05.zip"
EXCLUDED_DIRS = {
    "node_modules", "dist", ".git", ".local", "archive", "_workspace",
    "__pycache__", ".temp", ".wrangler", ".venv", "uploads", "storage",
    "coverage", "playwright-report", "test-results", ".npm", ".cache", ".impeccable",
}


def include(path: Path) -> bool:
    relative = path.relative_to(ROOT)
    if path.is_symlink() or EXCLUDED_DIRS.intersection(relative.parts):
        return False
    if any(part.startswith((".npm", ".vite", ".eslintcache", ".prettiercache")) for part in relative.parts):
        return False
    if relative.parts[:4] == ("apps", "home-preview", "public", "pdfjs"):
        return False  # Regenerated from the locked pdfjs-dist dependency.
    name = path.name
    if name.startswith(".env") and not name.endswith(".example"):
        return False
    if name.endswith((".local", ".local.json", ".log", ".pem", ".key", ".pyc", ".tsbuildinfo")):
        return False
    return name not in {".DS_Store", "Thumbs.db"}


def walk(directory: Path):
    for path in sorted(directory.iterdir()):
        if not include(path):
            continue
        if path.is_dir():
            yield from walk(path)
        elif path.is_file():
            yield path


files = list(walk(ROOT))
required = [
    "apps/home-preview/package-lock.json", "apps/home-preview/src/main.tsx",
    "apps/home-preview/public/fonts/Pretendard-Regular.woff",
    "apps/home-preview/supabase/migrations/20261105110000_execution_audit.sql",
    "docs/design/compass-adoption-20261105.md",
    "docs/development/verification-20261105.md",
]
relative_names = {p.relative_to(ROOT).as_posix() for p in files}
for name in required:
    if name not in relative_names:
        raise RuntimeError(f"Required source is missing: {name}")

# Reject likely real provider credentials; never print a value on failure.
secret_pattern = re.compile(rb"(?:AIza[0-9A-Za-z_-]{30,}|sb_secret_[0-9A-Za-z_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)")
for path in files:
    if path.suffix.lower() in {".md", ".json", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".sql", ".toml", ".py", ".example"}:
        if secret_pattern.search(path.read_bytes()):
            raise RuntimeError(f"Credential-like value in {path.relative_to(ROOT)}; inspect privately.")

OUTPUT.mkdir(exist_ok=True)
entries = []
with zipfile.ZipFile(ARCHIVE, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for path in files:
        content = path.read_bytes()
        name = "RMS/" + path.relative_to(ROOT).as_posix()
        archive.writestr(name, content)
        entries.append({"path": name, "bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()})

with zipfile.ZipFile(ARCHIVE) as archive:
    if archive.testzip():
        raise RuntimeError("Archive integrity failed")
    for entry in entries:
        if hashlib.sha256(archive.read(entry["path"])).hexdigest() != entry["sha256"]:
            raise RuntimeError("Archive source hash mismatch")

digest = hashlib.sha256(ARCHIVE.read_bytes()).hexdigest()
manifest = {
    "createdAt": datetime.now(timezone.utc).isoformat(),
    "archive": ARCHIVE.name, "archiveSha256": digest,
    "sourceFileCount": len(entries), "sourceRoot": str(ROOT),
    "excludes": sorted(EXCLUDED_DIRS) + ["private .env files", "*.local*", "generated PDF.js assets", "symlinks"],
    "files": entries,
}
(OUTPUT / "04_소스파일목록과_SHA256.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
(OUTPUT / "SHA256SUMS.txt").write_text(f"{digest}  {ARCHIVE.name}\n")
print(json.dumps({"archive": str(ARCHIVE), "sourceFiles": len(entries), "bytes": ARCHIVE.stat().st_size, "integrity": "pass", "sha256": digest}, ensure_ascii=False))
