#!/usr/bin/env python3
"""Delete named prim blocks from a USDA ASCII file.

USDA is brace-structured. For each target `def <Kind> "<NamePrefix>..."`
line, walk forward counting `{` / `}` to find the end of the block and
remove the whole span (including optional parenthesized metadata between
the def line and the opening brace).

Usage:
    strip-prims.py <in.usda> <out.usda> <NamePrefix>

Example:
    strip-prims.py scene.usda scene.stripped.usda Sylvaxe
    # removes every `def Material "Sylvaxe..."` and `def Xform "Sylvaxe..."` block

This is a text-level edit because pxr.Usd isn't generally available on
macOS without a full USD install. Works for simple cases where a prim
block is completely self-contained; not suitable for prims with cross-
references (e.g. bones in a shared skeleton).
"""
import re
import sys

if len(sys.argv) != 4:
    print(f"usage: {sys.argv[0]} <in.usda> <out.usda> <NamePrefix>", file=sys.stderr)
    sys.exit(1)

IN, OUT, PREFIX = sys.argv[1], sys.argv[2], sys.argv[3]

with open(IN) as f:
    text = f.read()

# Match any `def <Kind> "<PREFIX>..."` line.
escaped = re.escape(PREFIX)
pattern = re.compile(
    rf'^([ \t]*)def +\w+ +"{escaped}[^"]*"',
    re.MULTILINE,
)


def strip_block(s: str, match: re.Match) -> str:
    start = match.start()
    i = match.end()
    n = len(s)

    # Skip optional parenthesized metadata and whitespace until `{`
    while i < n and s[i] != '{':
        i += 1
    if i >= n:
        return s  # malformed — bail
    depth = 1
    i += 1
    while i < n and depth > 0:
        c = s[i]
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
        i += 1
    # Also swallow the trailing newline after the closing brace
    if i < n and s[i] == '\n':
        i += 1
    return s[:start] + s[i:]


removed = 0
while True:
    m = pattern.search(text)
    if not m:
        break
    text = strip_block(text, m)
    removed += 1

with open(OUT, 'w') as f:
    f.write(text)

print(f"wrote {OUT} (removed {removed} prim block{'s' if removed != 1 else ''})")
