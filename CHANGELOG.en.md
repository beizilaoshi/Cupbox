# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> 📖 **中文文档（默认）：[CHANGELOG.md](./CHANGELOG.md)**

## [1.0.1] - 2026-10-18

Everything since 1.0.0 (first public release). Consolidated by theme from the internal 1.1.0–1.6.0 milestones.

### Added — AI toolbox (benchmarked against opencode / Codex)

- `src/core/ai.ts`: dual-protocol adapters (OpenAI-compatible `/chat/completions` and Anthropic `/messages`), unified message model, timeouts and structured errors (a missing key returns a configuration guide instead of firing a request).
- `src/core/toolkit.ts`: the unified orchestration layer for the 14 local tools (`TOOL_DEFS` JSON Schema + `runTool()`); CLI, MCP and desktop share the exact same engine semantics.
- Subcommands `cupbox ai ask | agent | config`; config in `~/.cupbox/config.json` (mode 0600, key masked), env vars `CUPBOX_AI_*` take precedence.
- MCP gains `ai_ask` (read-only) and `ai_agent` (destructive annotation, returns a tool trace); tool count **14 → 16**; the agent loop defaults to 8 rounds (max 10), forces dry-run for `rename` / `organize`, and still requires an allowlist for `run` — **the AI never gains more permissions than a human user**.

### Added — Visual desktop app (stage 1/3)

- Portable local Electron app: main process calls the 14 engines in `dist/core` directly, sandboxed preload, plain static UI (no build step, fully offline); the packer produces `release/Cupbox可视化/Cupbox可视化.exe` (~236 MB).
- **Pixel obfuscation `obfuscate` (the 14th tool)**: six modes (gilbert / b / c / c2 / pe1 / pe2), ported from "番茄图片混淆 桌面版" ([MIT License, Copyright (c) 2026 3450892121](https://github.com/3450892121)) and **byte-for-byte cross-checked**, with 14 compatibility golden vectors kept in the test suite.

### Added — Chat workbench layout

- **Session sidebar**: new chat, persistent history (`~/.cupbox/sessions/`, ID allowlist against path traversal, delete / clear), workspace picker (workspace context injected into prompts).
- **Chat pane**: segmented Ask / Agent switch persisted to prefs; multi-turn history carried with every request; tool-trace cards; Enter to send, typing indicator and entrance motion.
- **Tool drawer**: the 16-tool form UI folded into a right-side drawer with grouped picking and transitions; Esc / scrim closes.
- **Settings modal, four tabs**: **API** (masked backfill), **Theme** (dark / light / follow-system × aurora / mint / amber / rose, 23 accent tokens derived via `color-mix()`), **Plugins** (toggles affect both the drawer and the Agent's tool set), **About & Updates** (version info + check the GitHub repository for new releases + shortcuts to repository / Releases / CHANGELOG).
- New IPC bridges (prefs / sessions / ws:pick / chat:send / update / open:external); **sessions persist only after a successful AI call**.

### Added — Update check & release announcement

- `src/core/update.ts` with three-tier sources: `CUPBOX_UPDATE_URL` custom manifest → **GitHub Releases** → npm registry (package name and repository ownership verified to avoid name-collision false positives); semver compare (accepts `v` prefix, pre-releases rank below releases); never throws; `CUPBOX_UPDATE_DISABLE=1` makes zero requests.
- CLI `cupbox update [--json]` (exit code 1 on failure); desktop breathing "vX.Y.Z available" badge with click-to-check on the version chip; **release announcement modal** (version diff, release notes, Download on GitHub / View changelog / Remind later — once per version, badge re-entry after dismissal); https-only IPC whitelist for external links; 5-minute main-process cache; lightweight toast component.

### Changed — Liquid-glass design system

- **Startup animation** (stroke-drawn logo, staggered letters, shimmer bar; skippable, honors reduced motion); glass panels (real SVG-displacement refraction where Chromium supports it, plain blur otherwise); three drifting aurora blobs plus grain; nav indicator ball, sheen sweeps, tool-switch transitions, focus glow, error shake; iOS-style switches; frameless window with custom controls and Windows 11 acrylic. Pure front-end, **zero new dependencies**.

### Security

- MCP `run_command` **denied by default** (requires `allowPrefixes` or `CUPBOX_RUN_ALLOW`) plus a quote-aware shell-metacharacter scanner in allowlist mode.
- Zip extraction pre-flight (zip-slip traversal refused + overwrite refused); PNG decompression-bomb guard (IHDR cap, 80M pixels); process kill requires PID **and** process-name match.

### Fixed

- The accent-token protection pass consumed semicolons in `:root`, breaking `--accent` / `--accent-2` / `--ok` so accent gradients failed to render — semicolons restored.
- `.tab-page { display: flex }` overrode the UA `[hidden]` rule and stacked settings tabs — added `.tab-page[hidden] { display: none; }`.

### Testing

- **176 → 197** test cases, all green: 68 obfuscation end-to-end cases + 14 golden vectors, `test/ai.test.ts` config and orchestration safety, and 11 `test/update.test.ts` cases (version compare, `data:` manifest, zero-request disable, GitHub/npm fallback, repository-mismatch rejection, never-throw fallback).

[1.0.1]: https://github.com/beizilaoshi/cupbox/releases/tag/v1.0.1

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
