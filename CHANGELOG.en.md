# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> 📖 **中文文档（默认）：[CHANGELOG.md](./CHANGELOG.md)**

## [1.1.1] - 2026-10-25

- Add remembered QQ login, negative affection and memories, a centered affection meter, live relationship updates, and local user data management.
- Update project, desktop, and displayed versions to 1.1.1.

## [1.1.0] - 2026-10-24

First official release.

- The Dream Weaving Meow pet gains feeding with little fish rice, snacks, brushing, resting and a three-tap yarn-ball mini-game; settings add a companionship journal, six relationship stages, affection plus three states, cooldown hints and an interaction log. Progress is stored locally per machine and offline time never deducts affection; rewards are granted only after a mini-game, cooldowns and daily reward caps are shared, and tasks or approval flows are never interrupted by interactions.
- Removed partial grid stretching, leg-rotation and non-uniform press/land motion from the desktop pet, keeping only light motion of the complete original art. Added the purple hanfu "Wisteria Moon Gauze" with 12 independent gait frames and 4 blink frames, bringing the wardrobe to 20 outfits; the four existing sports atlases now use 6 full gait frames, and the blink clock is no longer interrupted by gait switches.
- Added three hanfu for the pet — Green Bamboo Wind, Peony Spring Banquet and Moon-White Brocade — plus the Wisteria After-School JK, bringing the wardrobe to 19 outfits. Fixed transparent hair strands bleeding between grid cells, cross-cell shoe tips and residual mixing from old actions; wardrobe thumbnails now share the pet's independent character crop; new outfits support 60-phase walking, 30-frame blinking and lift/drop motion.
- Office capabilities expanded to 23: Word modification, templates and batch mail-merge; PPT replacement and reordering; Excel statistics, cleaning, formatting and merging; CSV import and text export; PDF read/write, merge, page extraction and watermarking. The external toolbox gains five filter classes and office workflows expand to eight. Source-file changes, batch path conflicts, permissions and preview tokens are still validated; PDF text reading clearly distinguishes scanned pages, and watermarks never masquerade as redaction.
- Office capabilities integrated into the external toolbox: a new "Office" category and seven dedicated tool cards that operate directly on body text, paginated text, Tab tables or "cell=value", with preview followed by explicit submission. The main chat gains four office workflow templates and scenes that keep drafts and never start model requests automatically; planning sub-projects inherit real file delivery and read-back verification requirements.
- Added 7 AI office tools: Word/PPT reading and authoring, Excel reading, authoring and cell updates. They offer three color schemes, paginated reading, content summaries, default save-as, preview approval and rollback, and are wired into the main chat, free-model compatible workflows and QQ owner mode. Settings add an "Office & development" section and seven sample shortcuts; macros, external links and formulas are never executed.
- QQ bot isolation audit: fixed text-only protocol messages being lost when vision is enabled, stale message completion re-queuing after stop or config changes, dedupe misses while waiting for new messages, and old connection callbacks polluting new connection state. Disconnected sends are marked as unknown and never auto-retried; the emoji save button shows a busy state and connection/queue hints are clearer, with experimental emoji diagnostics matching the current mode.
- The uninstall UI is unified into compact two-column cards: confirm, execute and finish share the Dream Weaving Meow glass frame and step indicator, and redundant whitespace and unusable buttons on the progress page are gone. The rounded gradient progress bar and percentage follow the real uninstall engine, and the data-retention hint is displayed on its own.
- Fixed the uninstall progress bar intruding into the Dream Weaving Meow illustration area: progress, status and description are pinned to the left column while the illustration uses an independent right column; the progress bar's parent container, width and height are set explicitly and boundaries validated so controls cannot overlap or overflow the content area.
- Fixed installer wizard buttons floating over the page bottom: primary and secondary buttons now sit in a dedicated bottom bar, the page's original content height is preserved, at least 16 scaled units of spacing are kept above and below the buttons, and step hints are centered with the buttons.
- Fixed pet action edge bleeding: grid cells are isolated on integer pixels with a transparent sampling border, stray edge fragments inside cells are cleared, and walking body and feet use separate textures. Action transitions keep only the old picture inside the new silhouette, preventing hands and skirt from the previous action lingering; click detection over transparent areas is updated accordingly.
- Remade the install and uninstall visuals again: Dream Weaving Meow glass-frame sidebar, standalone rounded function cards, blue-purple gradient primary button, soft danger button and shield data card; buttons support continuous hover/focus feedback while keeping keyboard operation and accessible names. UI assets are preloaded to shorten the wait before the guide opens.
- Install and uninstall guides now use a sakura blue-purple style: the welcome page offers switchable Dream Weaving Meow feature cards, the location and shortcut pages gain illustrations and clear data hints, and installation shows real progress. Exit-install, uninstall confirmation and uninstall completion use the same style of illustrated cards; uninstall preserves user chats, configuration, emoji library and memory, and silent deployment still supports unattended installs.
- The Dream Weaving Meow hugging the Logo opening gains a pure-white rounded backdrop, plus 11 festival outfits and 4 interaction compositions; Logo settings are grouped into daily, action, foldable festival wardrobe and geometric marks. Added a disableable opening micro-motion and optional local-date auto outfit change that restores the manual choice after the festival, synced across the UI, taskbar and tray. The sakura prologue still defaults to 5 seconds.
- Fixed the taskbar still showing the original icon after a custom Logo: the main window, QQ window and tray now sync native icons and restore the saved style on startup; a multi-size ICO (16–256 px) is generated, a content fingerprint bypasses the old icon cache, and only existing shortcuts pointing at the current program are updated.
- The Dream Weaving Meow continuous actions are upgraded: 31 actions with 60 key poses each, interpolation up to 60 fps, blinking changed to 30 frames, and the head and eyelids deform on the same layer. Added nodding, head tilt, ear twitch, leaning out, paw wave, thanks, yawn and smug, plus part-specific touch feedback, idle micro-motions and 52 lines of dialogue. Kept displacement-synced walking, nape lifting, gravity landing and 2x press sound effects. Added four generated outfits for the Dragon Boat Festival, Qixi, National Day and Winter Solstice, bringing the wardrobe to 15, with automatic outfit change covering the new festivals.
- Unified the QQ settings page's type scale, controls, spacing and hint hierarchy; trimmed duplicate emoji-mode titles, fixed whitespace in the third card, tidied the nested borders of the innovation settings, and improved the narrow-window save bar and keyboard focus.
- The QQ emoji mode now uses card selection consistent with Agent presets, intuitively showing the flow, invocation and upload hints of the three modes; it supports a separate description, keyboard switching, a pending-save state, light/dark themes and narrow-window layouts.
- QQ emoji adds a third mode, "experimental innovation": explicit image requests use the old channel with same-image dedupe, while other messages are pre-filtered by code before an independent briefing model reads the latest 15 existing chats. The text and visual channels each recall 4 images, merge and dedupe them, then generate a randomly numbered collage of 4 by default (optionally 6 or 8). A single vision call is limited to 2 seconds with hard thresholds on confidence, in-image text, emotion/action and safety; private chats, @-mentions and first-time images get a reverse-order re-test. Supports waiting for image selection in parallel with text, group disabling, an experimental card and blocklist, and dedupe persistence for the last 10 images. After the image receipt is confirmed, the actual in-image text and scene are written back; an optional local detailed log keeps up to 20 rounds including collages, candidate order, seeds, latency, send results and known cost, off by default with risk confirmation.
- QQ emoji adds an "innovation" mode while the existing logic becomes "standard" and stays the default. Innovation mode configures the judgment and vision models independently and uses the latest 1–20 existing records of the current conversation: it first decides whether to send an image and which type, then recalls up to 20, dedupes against the last two and coarse-filters to 3, and hands the actually decoded images to the vision model for review. Score breakdowns are explicit, the threshold is 8 points, ties send nothing, and failures never fall back. Extra chat or image uploads require risk confirmation; the real image meaning and receipt after QQ confirmation are written back under the original memory switch, and logs keep stages and scores without body text or image data.
- The configurable startup-animation duration limit is raised to 20 seconds, still 5 by default; geometric scene timelines are extended to match and remain skippable at any time.
- The sakura prologue is enhanced: original art, palette, composition, typography and frosted-glass style are kept, with 1280 layered wind-driven petals, a gathering garland, near-field soft focus, pollen light streaks and multi-layer soft ripples; the glass gains a brief light sweep and the foreground flexibly avoids the Logo and text area. It still defaults to 5 seconds and supports custom Logo, skip and reduced motion.
- Fixed QQ bot UI jitter while scrolling: removed the horizontal overflow caused by whole-row sidebar translation, and the sidebar and main content area use fixed scroll-gutter widths; icon interaction animations and normal vertical scrolling of the content are kept.
- Fixed the background-music settings layout: titles, controls and descriptions for playback mode and volume are aligned, narrow content areas stack vertically, the top playlist button's negative margin is removed, and button heights and icons are unified to prevent overlap.
- Added independent Logo style settings: 15 built-in marks (including 3 original transparent Dream Weaving Meow hug images), support for local PNG/JPG/WebP import, instant switching and restoring the original mark; synced to the main window, QQ window, startup animation and about page, with preferences and imported copies saved in local documents.
- Besides the sakura prologue, the other 13 built-in openings were remade: the left/right split cards are gone in favor of full-screen generated scenes, centered geometric performance, camera motion, light waves and a staged brand entrance; geometry gains crystal faceting and materials. Added 10 local original artworks (starry sea, mountain sea, moon sea, crystal dome and per-style environments); the landscape opening and minimal breathing are upgraded to cloud-realm roaming and light-core bloom while keeping the old config IDs. The sakura prologue's code and assets are unchanged and still default to 5 seconds.
- Added background-music settings and a local playlist: four built-in tracks (Petal Drift, Where the Light Rests, Morning Sync, Petals on the Glass), local batch import, deduplication, track switching, independent volume, and shuffle/sequential/single-loop playback. Disabled tracks leave the queue; built-in tracks can only be disabled, while custom tracks have their local copy deleted after same-style confirmation, keeping the original file. A single player is shared with the main window and QQ top bar, and preferences persist.
- Fully upgraded 11 program openings: flowing-rainbow satin aurora, teal mountain-sea gold ink, layered fireworks, and moon surface with dynamic sea reflections; five geometric styles add a 3D honeycomb, five-fold lattice, double origami, a fine iridescent Möbius surface and emerald crystal facets. The Logo, gradient name and frosted-glass panel enter in unified stages, and every thumbnail carries the brand; the sakura prologue still defaults to 5 seconds with the default mark.
- Remade the two Fantasia Quant openings: the matrix prologue adds a deep-space jump, 27 3D glass cubes converging, light trails and an energy shockwave; star-ring computation adds a tilted accretion disk, seven-layer 3D star rings, comet trails and aurora. The Cupbox Logo, gradient name and frosted-glass panel enter in stages, animations scale with the user's duration setting, and the version and 5-second default are unchanged.
- Added five geometric openings — Lattice Ark, Hexagonal Hive, Origami Prism, Möbius Ring and Star-Orbit Polyhedron; the two Fantasia themes also show the Cupbox Logo and name, and the thumbnails of all seven geometric animations keep the brand. Added geometry/lighting filters and kept the 5-second default.
- Added two "Fantasia Quant" theme startup animations: the ice-blue nine-grid matrix convergence "Matrix Prologue" and the moon-white indigo particle-halo "Star-Ring Computation"; they have independent titles and thumbnails, keep the original 5-second duration and skip setting, and restore the Cupbox title on exit.
- Added four startup scenes — Flowing Rainbow Star Curtain, Ink-Washed Blue Mist, Stardust Fireworks and Moon-Sea Glow — keeping the 5-second default and custom assets; added eight dark/light mixed palettes including a star-rainbow gradient and ink green, the QQ window follows live, reduced motion is respected, and the whole UI or images are never hue-filtered.
- Added the user-provided Petal Drift local background music, looping automatically on first launch; the main window and QQ top bar share one vinyl switch showing a rotating record and floating notes, pausing stops the animation and remembers the choice, and reduced motion is supported.
- Drawing on AstrBot's tone examples, Amadeus's per-conversation configuration and the MaiBot ecosystem's conversation-hygiene mechanisms, QQ adds rewritable fictional dialogue examples, independent chat rhythm per group and private chat, and expression hints that use the preceding context to reduce repeated openings, mechanical follow-ups and forced continuation after a goodbye; it keeps the existing models, source persona, safety checks and approval flow with no extra model rounds.
- QQ memory adds default-on local compressed summaries with an estimated 2000–12000 token budget: old conversations are excerpted by identity while recent ones stay verbatim as far as possible, summaries are previewable and persisted per conversation, and raw records keep their previous retention cap. Normal chat no longer re-submits or re-compresses old history and adds a token trigger plus a local excerpt fallback when summarization fails.
- Reorganized the QQ bot settings: grouped into basics, companion assets and advanced maintenance, with reply targets, chat rhythm, role, model, memory and permissions in their proper places; added Ctrl+K feature search and locate, in-page section jumps, dependency hints, a cross-page draft count with undo, and same-theme inline validation, while keeping asset edit drafts and all existing configuration.
- QQ adds "Relationship & Mood", drawing on Xiyu AI and reusing its MIT emotion and memory-decay pure modules: unified affection, trust and familiarity, event emotion, a companionship diary, follow-up on unfinished events, a fictional schedule and local preference pinning; it keeps the original strategy saves and send confirmation, never double-counts scores, does not deduct offline, and clearly shows the data and feature boundaries.
- QQ autonomous chat adds a no-duplicate @ reply window, three chat rhythms, short-sentence bubbles and character-based pauses; autonomous rounds, messages and character quotas are adjustable, and it adds native emoji, follow-up replies, random dice and lots, persistent current-conversation reminders and a local cancel entry. Blue Big Fat Fish keeps its original default and offers an explicit free-play switch to unlock name, personality and gameplay customization.
- Fixed scanline breaks, shoe deformation and eye misalignment in 11 outfits while walking; changed to a 30-pose, 30 fps joint gait with ease-in and ease-out, reusing the original assets and release directory.
- The QQ bot merges qq-bridge's conversation-tool ideas, adding current-conversation message and quote tools, dive wake-up, a local-confirmation glossary, voice assets, a private-chat list, conversation notes, persona copies and actual usage statistics; it keeps NapCat auto-connect and the original safety approval boundary.
- The Dream Weaving Meow pet adds seven festival outfits: the festival wardrobe is folded by default and switches automatically by local date, with the Spring Festival, Lantern Festival and Mid-Autumn calculated by the lunar calendar; manual selections are kept and restored after the festival.
- Enlarged the walking stride, foot lift and body bob, driven by a continuous displacement phase; the pet also blinks naturally while walking and turning.
- The main settings add a searchable plugin center: compose role, time, file, terminal, network and desktop capabilities per Agent preset, manage local output-inspection extensions, and import, configure, test and disable them.
- Agent presets gain risk tags and same-theme confirmation; custom presets can be added, edited and deleted, inherit the base presets' safety boundaries, and persist locally.
- Removed three unused legacy opening backgrounds (~8 MB total) and fixed settings page switching stealing keyboard-navigation focus.
- Lifting the Dream Weaving Meow pet now uses a nape-held dangling posture with natural blinking instead of looping struggle.
- Four skins had their small gait redrawn and the walking speed lowered; the gait still follows actual displacement and release gravity and landing cushion are kept.
- The startup animation was remade as the "Sakura Prologue": layered falling petals, branch sakura, soft light and a glassy logo, supporting light/dark themes, skip, disable and custom assets.
- Tests: **788** test cases across 73 files are green (up from 519).

## [1.0.3] - 2026-10-21

### Main window close & tray (2026-10-21)

- Closing the main window now asks whether to hide to the tray or quit, and states that the QQ bot keeps running in the background; quitting asks for confirmation and stops the QQ bot together with the app.
- Added a system tray icon with show window, hide to tray and quit actions; when the tray is unavailable the close prompt only offers quit or cancel instead of pretending the window was hidden.

### Startup announcement (2026-10-21)

- Added `announcement.json` at the repository root: after the startup animation, Cupbox shows the announcement from GitHub with title, body, date and an optional link; the test announcement reads "欢迎使用 Cupbox 工具箱".
- The announcement is checked once per launch; when its content (title / body / date / id) changes it is shown again even if the user previously chose "don't show again". With unchanged content, that checkbox keeps it hidden. Check failures stay silent.
- Body text is rendered as plain text and links only allow https; use `CUPBOX_ANNOUNCEMENT_URL` to override the address or `CUPBOX_ANNOUNCEMENT_DISABLE=1` to disable it. See docs/ANNOUNCEMENTS.md.

### QQ bot (2026-10-21)

- Added the "1021 character dialogue" build: rewrote the Whale-girl identity with tone examples separating in-character questions from real-person probing; the old shell-persona self-description is only skipped in model context, never deleted from original memories. Adds an optional one-off tool-free tone correction that checks first and then writes in segments, explicitly warning that it may add requests.

- Added the "1021 meme direct-send" build tag (version stays 1.0.3) synced to the common portable directory; explicitly requesting any meme now performs the real send directly, distinguishing total gallery size from matched count so the model can no longer claim it cannot send images. Added 3 original transparent cat memes with preview, confirm-to-add/enable and duplicate protection.

- Expanded to 14 built-in personas plus a custom option, with category/search/example cards; added sweet romance, slow-burn courtship, character positioning, forms of address, 4 story scenes and pacing. Courtship proposals cite original lines and archive after actual replies, isolated per account/session/user/persona/scenario, defaulting to private chat, with confirmed single-track reset.

- Adapted companion chat inspired by Amadeus: layered personas, merged consecutive in-group messages, explicit silent/bulk interjection judgment scoped to groups, quiet skip vs direct-@ priority; added a preference profile backed by quoted evidence, time and memory tools, UI suggestion drafts and separate risk confirmations. Existing toggles are not auto-enabled; version stays at 1.0.3.

- Added a session-scoped `send_meme` tool following dsh-meme's search/send/result-feedback flow, meaning-based image selection, free text-model compatibility, and real send results persisted with the conversation; the original keyword restriction is kept, failed sends are never retried, and turns with tools wait for results before emitting further segments.

- Fixed over-reliance on model-chosen meme IDs for the send condition; added trigger-word hit auto-selection vs model-only judgment, single-character trigger words, the master toggle state, local condition checks, and manual testing after confirmation.

- Added image decode normalization plus validation of QQ send return codes and message IDs; errors or unknown results are never resent automatically.

- Added a real-time console: stage/level filters, search, pause, auto-scroll, error alerts, redacted copy and JSONL export; keeps a bounded in-memory log and by default never writes chat bodies, keys or image data.

- Auto-memory persists to the system documents directory, supporting per-account global sharing or isolation per group/private chat; stopping, pausing or disabling auto-memory never deletes the files, with view, edit and confirm-before-delete.

- Free models can join workflows and the experimental JSON tool-compat loop, with warnings about third-party data, rate limits and instability; local operations require per-action approval, format anomalies or execution failures stop immediately, keeping path and preview protections.

- Redesigned the QQ space layout: compact connection area, local chat-pacing preview, on-demand advanced settings; added sidebar, page, toggle, bubble and dialog animations with reduced-motion adaptation.

- Natural semantic segmentation replaces the default mechanical character truncation, keeping short replies, code and lists intact; a character-count compatibility option is retained. Added three chat expression strategies: casual, balanced, detailed.

- Normal conversation memory is independent from bystander listening: already-triggered conversations are remembered by default while bystander listening stays off; group/private isolation and the temporary-memory lifecycle are preserved.

- Redesigned setup steps, saved scopes and draft hints, distinguishing login from auto-reply; added risk confirmations for pause-now, enable, data sharing, context clearing and memory override.

- Added all-groups / whitelist / blacklist plus a post-login checklist of real group lists; excluded groups collect no context, and legacy allowed group numbers migrate automatically.

- Added configurable segmented streaming replies with inter-segment pacing and per-segment rate limiting; plain-text SSE streams as it generates, tool flows segment after completion, and stopped replies never resend already-sent segments.

- Separated the submitted model message body from the QQ identity; history uses an independent identity field so QQ numbers never mix into message content.

- Added a dedicated bot window hosting NapCat preparation, checks, auto-configuration, QR-code login and heartbeat reconnection, with no manual OneBot configuration required.

- Group @/keywords, private chat and address terms, group-number scope, per-subsession context count and rate limits are all configurable; auto-reply and bystander listening default to off.

- Reuses the model library and app-wide global memory, with independent chat/work mode, persona, temperature and effort-depth choices; search and image understanding can be disabled separately.

- Custom meme meanings and trigger words send at most one image after backend verification; local file operations requested by the owner require per-action approval.

- Version stays at 1.0.3; usage and upstream sources are documented in docs/QQ-BOT.md.

### Windows installer

- Added a complete offline installer, a Chinese branded welcome page, light/dark sakura wizard images, step hints, and a quick-start walkthrough.
- Optional install location, Start-menu and desktop shortcuts; in-place upgrade and uninstall preserve user conversations and configuration, and no auto-start entry is added.
- Added `npm run pack:installer` with SHA256 checksum output; the installer builds into its own staging directory and no longer clears the whole release folder. Version stays at 1.0.3.
- Installation notes and the current code-signing status are documented in docs/WINDOWS-INSTALLER.md.

### Free models, chat model picker & effort slider

- Completed the free-model catalog refresh, the global toggle plus per-model toggles, minimal connection checks, and the "use in chat" entry; unavailable channels are never allowed through, and turning models off never silently switches providers.
- The model button in the input box is now a searchable grouped menu for direct switching; added a model-aware effort slider with per-model memory that persists and restores per-session choices.
- Effort maps to real OpenAI / DeepSeek / OpenRouter parameters; unknown models keep their defaults or accept an explicit override. Free requests never reuse paid API keys, and the cancellation signal is propagated into the network layer.
- The interaction references dsh-codex-effort-slider, adapted independently to the existing desktop UI; reduced-motion remains respected and the version stays at 1.0.3. See docs/CHAT-MODELS-AND-EFFORT.md.

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
- 1.0.3 grows again to **519** test cases across 48 files, all green, adding 19 more: announcement, computer, free-workflow, loopback-audit, plugins, ui-prompts and 13 QQ suites (bot, companion, conversation, emoji-delivery, emoji-import, meme-request, memory, roleplay, romance, security, service, streaming, whale-source).

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
