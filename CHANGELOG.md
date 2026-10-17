# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-10-17

First stable release. Project renamed from `chorebox` to `cupbox`.

### Added

- **CLI + MCP dual form** — 13 tools available both as `cupbox <command>` and as MCP tools for Claude Desktop / Cursor / Cline.
- File chores: `organize` (by type/date/regex), `rename` (template/regex, collision-safe), `search` (name + content, skips `node_modules`).
- Data chores: `hash` (md5/sha1/sha256/sha512), `time` (s/ms auto-detect, ISO, UTC+8, relative), `codec` (base64/URL/HTML/JSON), `csv` (RFC 4180 both ways), `zip` (create/extract/list, UTF-8 names).
- System chores: `ocr` (Windows native / tesseract, Chinese OK), `clip` (read/write), `shot` (native PNG), `run` (allowlist + timeout + output truncation), `proc` (list/kill with PID **and** name double-check).
- AI safety: destructive MCP tools default to `dryRun=true`; `CUPBOX_DISABLE_TOOLS` env to hide tools from agents.
- `--json` output on every CLI command.
- CI matrix: Windows + Ubuntu × Node 18/20/22.

[1.0.0]: https://github.com/beizilaoshi/cupbox/releases/tag/v1.0.0
