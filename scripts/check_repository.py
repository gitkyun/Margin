#!/usr/bin/env python3
"""Check Margin's required files and local Markdown/HTML file links."""

from __future__ import annotations

import argparse
import os
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

REQUIRED_FILES = (
    "README.md",
    "AGENTS.md",
    "CONTRIBUTING.md",
    "docs/README.md",
    "docs/product/prd.md",
    "docs/product/functional-specification.md",
    "docs/product/user-flow.md",
    "docs/design/README.md",
    "docs/development.md",
    "docs/deployment.md",
    "docs/architecture.md",
    "SECURITY.md",
    "CHANGELOG.md",
    ".github/workflows/repository-checks.yml",
)
EXCLUDED_DIRS = {".git", "node_modules", ".next", ".venv", "dist", "build", ".local", ".npm-rms-cache", ".impeccable"}
MARKDOWN_LINK = re.compile(r"!?\[[^\]\n]*\]\(\s*(<[^>\n]+>|[^\s)]+)(?:\s+[^)]+)?\)")


class HtmlLinks(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.targets: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for name, value in attrs:
            if name in {"href", "src"} and value:
                self.targets.append(value)


def without_code_blocks(text: str) -> str:
    lines: list[str] = []
    fence: str | None = None
    for line in text.splitlines():
        stripped = line.lstrip()
        if fence is None and stripped.startswith(("```", "~~~")):
            fence = stripped[:3]
        elif fence is not None and stripped.startswith(fence):
            fence = None
        elif fence is None:
            lines.append(line)
    return "\n".join(lines)


def markdown_files(root: Path) -> list[Path]:
    found: list[Path] = []
    for directory, names, files in os.walk(root):
        names[:] = sorted(name for name in names if name not in EXCLUDED_DIRS)
        found.extend(Path(directory) / name for name in sorted(files) if name.endswith(".md"))
    return found


def check(root: Path) -> tuple[list[str], int, int]:
    root = root.resolve()
    errors = [f"Missing required file: {name}" for name in REQUIRED_FILES if not (root / name).is_file()]
    documents = markdown_files(root)
    checked_links = 0
    for document in documents:
        text = without_code_blocks(document.read_text(encoding="utf-8"))
        targets = [match.group(1).strip("<>") for match in MARKDOWN_LINK.finditer(text)]
        parser = HtmlLinks()
        parser.feed(text)
        targets.extend(parser.targets)
        for target in targets:
            parts = urlsplit(target)
            if parts.scheme or parts.netloc or not parts.path:
                continue
            checked_links += 1
            relative = unquote(parts.path)
            path = root / relative.lstrip("/") if relative.startswith("/") else document.parent / relative
            resolved = path.resolve()
            if not resolved.is_relative_to(root) or not resolved.exists():
                errors.append(f"{document.relative_to(root)}: broken local link: {target}")
    return errors, len(documents), checked_links


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    root = args.root.resolve()
    errors, document_count, link_count = check(root)
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    print(f"OK: {len(REQUIRED_FILES)} required files, {document_count} Markdown files, {link_count} local links.")
    print("External URLs, heading anchors, and application behavior were not checked.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
