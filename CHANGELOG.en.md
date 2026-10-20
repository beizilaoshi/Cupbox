# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> 📖 **中文文档（默认）：[CHANGELOG.md](./CHANGELOG.md)**

## [1.0.2] - 2026-10-20

### Windows installer

- Added a complete offline installer, a Chinese branded welcome page, light/dark sakura wizard images, step hints, and a quick-start walkthrough.
- Optional install location, Start-menu and desktop shortcuts; in-place upgrade and uninstall preserve user conversations and configuration, and no auto-start entry is added.
- Added `npm run pack:installer` with SHA256 checksum output; the installer builds into its own staging directory and no longer clears the whole release folder. Version stays at 1.0.2.
- Installation notes and the current code-signing status are documented in docs/WINDOWS-INSTALLER.md.

### Free models, chat model picker & effort slider

- Completed the free-model catalog refresh, the global toggle plus per-model toggles, minimal connection checks, and the "use in chat" entry; unavailable channels are never allowed through, and turning models off never silently switches providers.
- The model button in the input box is now a searchable grouped menu for direct switching; added a model-aware effort slider with per-model memory that persists and restores per-session choices.
- Effort maps to real OpenAI / DeepSeek / OpenRouter parameters; unknown models keep their defaults or accept an explicit override. Free requests never reuse paid API keys, and the cancellation signal is propagated into the network layer.
- The interaction references dsh-codex-effort-slider, adapted independently to the existing desktop UI; reduced-motion remains respected and the version stays at 1.0.2. See docs/CHAT-MODELS-AND-EFFORT.md.

### Feature illustrations & icon motion

- Added four transparent feature illustrations used by the home quick actions, tool categories, search empty state, and model-collaboration guidance.
- Settings, notifications, folder, tool and search icons respond to hover and keyboard focus; copying shows a brief checkmark, and sub-task icons reflect real run states.
- Honors the system reduced-motion setting while keeping text feedback; no network-hosted icons or animation dependencies are introduced.
- Assets and final prompts are documented in docs/FEATURE-VISUALS.md.

### UI & risk interactions

- Redesigned the default startup sequence with a new "sakura clear-window" illustration, keeping local custom media and reduced-motion support.
- Added tiered notification cards and a notification center; errors are dismissed manually and informational prompts can be reviewed later.
- Risk dialogs lead with consequences, targets and directories, with a checkbox required for high-risk actions; switching into full control or the native environment now requires an up-front explanation.
- Unified the settings pages' hierarchy, type scale, cards and press feedback; the developer tools gained Chinese labels and empty states, and the command tool's stale allowlist form was corrected.
- See docs/UI-EXPERIENCE.md for asset sources and the final prompts.

### Dev-tool capability completion

- The desktop Agent gained 36 dev-tool interfaces covering paginated file read/write, patch, backup & rollback, HTTP, diff/grep/replace, a real persistent ConPTY, processes/ports, image processing, Git, project script/test parsing, project memory/todos, context attribution, and the image clipboard.
- Destructive file modifications default to preview and commit with a one-time token bound to the parameters and snapshot; out-of-repository paths and junction escapes are rejected.
- Project policy proposals are never auto-trusted; Shell and terminal input require human approval even in full-control mode; domain authorization plus DNS pinning block SSRF.
- Added the "Development & authorization" interface with structured results, preview-then-run buttons and policy editing. When long tool results are compacted, valid JSON and tokens are preserved.
- See docs/WORKBENCH.md (security convergence and boundaries included).

### Responses, feedback & scene workflows

- Markdown is rendered with Marked and DOMPurify, with copy actions for the body, Markdown and code blocks; tool traces collapse and file tools show Chinese names.
- Added helpful / inaccurate feedback that affects later reference and history filtering; long-term memories are saved only after explicit confirmation, can be edited and removed, and a negative rating revokes the stored memory and rebuilds the summary.
- Added task scenes, automatic flow selection, dependency scheduling, upstream delivery hand-off, failure blocking, and optional acceptance / one-shot correction.
- Reuses the official MCP Filesystem's 10 file capabilities; in execution mode sub-projects land in independent directories for the coordinating model to integrate, and writes still go through approval. The portable build ships the full production dependencies.
- See docs/RESPONSES-AND-WORKFLOWS.md.

### Context insight (capability direction inspired by [dsh-context](https://github.com/bowenliang123/dsh-context))

- Added `src/core/context.ts`: fixed-density token estimation (≈1.5 chars/token for CJK, ≈4 for others), **six-part breakdown** (system prompt / tool schemas / user messages / injected context / assistant replies / tool results), capped trend points and events, compact token formatting.
- Added CLI `cupbox context [--text TEXT] [--file PATH] [--window 128000] [--json]`: estimates text occupancy; with no text it returns the **Agent baseline overhead** (system prompt + all tool schemas).
- Added MCP tool `context_stats` (read-only) — **tool count 20 → 21**; orchestration layer `TOOL_DEFS` now has 19 entries.
- AI calls now capture **provider-reported usage**: `aiChat` reads Anthropic `input_tokens/output_tokens` and OpenAI `prompt_tokens/completion_tokens`; `aiAgent` accumulates them across the loop and returns the request count.
- Desktop: each turn stores the breakdown, occupancy trend (including real in/out tokens) and four event kinds (inject / compact / model switch / mode switch) in the session record; a new **"Context"** button in the chat header opens an insight panel with KPIs, a stacked composition bar, a per-request trend chart and the event feed. `CUPBOX_CONTEXT_WINDOW` adjusts the window size.
- Estimates are heuristic (≈), not exact tokenizer counts, meant as a rough occupancy reference.

### Earlier updates in the same version (2026-10-19)

### Storage & model management

- **Data now lives in your OS Documents folder (`Documents/Cupbox`)** — config, API keys, model library, sessions and memory. On first launch the legacy `~/.cupbox` is migrated automatically: copy-only (never deletes), never overwrites a non-empty target, and failures are silent so startup is never blocked. `CUPBOX_HOME` still overrides everything (portable / test isolation).
- Added `src/core/paths.ts` as the single source of truth for the data directory (same semantics across CLI / MCP / desktop); both the CLI `main` and `startMcpServer` migrate on startup.
- Settings → Model connection now has an **API storage card**: shows the current data directory with one-click "open storage folder" and "reveal `config.json`".
- Added a **Model management** entry in the sidebar that jumps straight to the model library (add/remove multiple models, capability multi-select for text / vision / image / audio / video, per-model enable toggle).

### Live tool-call visualization & chat bubbles

- While the agent executes a task, **tool calls stream live as cards** — tool name, arguments, an "executing" animation, then completion time or a red failure line with the error detail; the final message's full trace takes over afterwards.
- `aiAgent` gained an `onToolStart` callback (fires before completion); the main process pushes `chat:tool` IPC events (phase=start/done) to the renderer, filtered by `runId`.
- **Assistant replies are now bubbles**: card surface with a bottom-left tail and a header, mirroring the user bubble, with an entrance animation and a red-outlined error bubble.

### Three-tier memory & context compaction (architecture inspired by [dsh-mnemon](https://github.com/omdsh-dev/dsh-mnemon))

- Added `src/core/memory.ts`: runtime memory (user profile & working agreements, always injected into the system prompt), long-term facts (`facts.jsonl`, relevance-recalled via CJK bigrams + Latin tokens), and session summaries.
- Added context compaction: when history exceeds the budget (24 000 characters by default) older turns are distilled by the model into a ≤400-character summary, keeping only the last 8 messages verbatim. The summary is merged into the system prompt and carries forward. Without an AI configuration it degrades to plain truncation and never blocks the chat.
- Added the CLI subcommand `cupbox memory add|search|list|stats|forget|user|collab`.
- Added four MCP tools — `memory_remember` / `memory_recall` / `memory_manage` / `memory_profile` — bringing the MCP tool count **16 → 20**; the toolkit layer `TOOL_DEFS` is now 18 so the desktop agent can remember things across sessions.
- Desktop `chat:send` now auto-injects relevant memories into every conversation and shows a "compacted N earlier messages" chip when compaction triggers.
- Fixed `cupbox memory add <text> --source <tag>` parsing where the tag value leaked into the text.

### Multi-model & project workflows

- Added independent model profiles and text, vision, image, speech and video routing; multi-model mode is off by default.
- Added direct handling, sequential production, parallel large-project and review workflows with explicit worker selection and progress panes showing each sub-project's real progress.
- Added reference images, local media persistence, sub-project duplication with failure retries, stop requests, Markdown export and draft recovery.
- Fixed window-minimize positioning and added Ctrl+M. Video currently uses the SiliconFlow submit/status protocol. See docs/DESKTOP-MODELS.md.

### Model connections and tool execution

- Added provider presets for SiliconFlow, DeepSeek, GPT, Claude, OpenRouter, Ollama, LM Studio and custom endpoints, with model listing and connection checks; changing the provider or address never reuses old credentials.
- Added request approval, smart approval and full control, plus a file sandbox / native execution mode, shared by manual tools and the desktop Agent.
- Replaced the tool drawer with a dedicated workspace featuring category cards, search, path pickers, examples, retained inputs and results, and structured result lists and tables.

### Desktop appearance and startup

- Added configurable startup animations: light-track departure, scenic opening, minimal breathing, plus local GIF, MP4, WebM or image media; with preview, toggle, duration, caption, skip controls and reduced-motion support.
- Expanded to eight built-in themes — Sakura Clear, Bloom, Moon Lake, Flower Garden, Aurora, Dunes, Ink and Solid — with category filters and matching interface tones, while retaining custom backgrounds.
- Redesigned the geometric folded-box logo, synchronized across SVG, PNG, ICO and the desktop window icon.
- Aligned the CLI, desktop and portable package versions at 1.0.2.

### Testing

- **198 → 331** test cases, all green, with 12 new test files (freemodel, context, memory, paths, workbench, execution, model-workflow, chat-choice, workflow-scenes, response-context, filesystem-tools, workbench-http).

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
