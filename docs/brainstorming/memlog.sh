#!/usr/bin/env bash
# Minimal stand-in for _bmad/scripts/memlog.py (absent in this project).
# usage: memlog.sh <workspace> <type> <text> [by]
set -euo pipefail
WS="$1"; TYPE="$2"; TEXT="$3"; BY="${4:-coach}"
printf -- '- **%s** (%s): %s\n' "$TYPE" "$BY" "$TEXT" >> "$WS/.memlog.md"
