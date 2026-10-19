# Cupbox

<p align="center">
  <img src="https://img.shields.io/npm/v/cupbox?style=for-the-badge&color=cb8a52" alt="npm version">
  <img src="https://img.shields.io/node/v/cupbox?style=for-the-badge&color=438f70" alt="Node.js">
  <img src="https://img.shields.io/github/actions/workflow/status/beizilaoshi/cupbox/ci.yml?branch=main&style=for-the-badge&label=CI" alt="CI">
  <img src="https://img.shields.io/badge/license-MIT-5279c7?style=for-the-badge" alt="MIT License">
</p>

<p align="center">
  <strong>Let the CLI and AI handle the busywork.</strong>
</p>

<p align="center">
  One toolkit, two ways to work.<br>
  A practical command-line toolbox for developers and an MCP server for AI agents.
</p>

<p align="center">
  <a href="#-why-cupbox">Why Cupbox</a> ·
  <a href="#-features">Features</a> ·
  <a href="#-quick-start">Quick Start</a> ·
  <a href="#-connect-your-ai">Connect Your AI</a> ·
  <a href="#-security-by-design">Security</a> ·
  <a href="#-contributing">Contributing</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/cupbox">npm</a> ·
  <a href="https://github.com/beizilaoshi/cupbox">GitHub</a> ·
  <a href="./README.md">简体中文</a>
</p>

---

## 📦 What Is Cupbox?

**Cupbox is a lightweight toolbox for everyday development tasks.**

Every development workflow comes with small, repetitive jobs:

- Sorting a cluttered Downloads folder.
- Renaming hundreds of images according to a consistent pattern.
- Searching a codebase without getting buried in dependencies and build artifacts.
- Calculating file hashes, converting timestamps, or processing JSON and CSV.
- Extracting text from screenshots, creating archives, or inspecting compressed files.
- Letting an AI assistant work with local files without handing it unrestricted system access.

Each task may seem trivial on its own. Together, however, they consume time, interrupt concentration, and encourage developers to write disposable scripts for problems that have already been solved.

Cupbox brings these scattered utilities together in one reusable toolkit.

### One toolkit. Two interfaces.

```text
                       Cupbox
                          |
                +---------+---------+
                |                   |
             CLI                 MCP Server
                |                   |
        Direct developer use    AI agent access
                |                   |
                +---------+---------+
                          |
                    Shared core
                          |
             +------------+------------+
             |            |            |
          File Ops     Data Tools   System Tools
             |            |            |
             +------------+------------+
                          |
                  Shared safety rules
```

- **CLI:** For developers working directly in the terminal, writing scripts, and automating repetitive tasks.
- **MCP:** For AI agents that need structured access to local utilities through the Model Context Protocol.
- **Shared core:** Both interfaces reuse the same underlying functionality instead of maintaining separate implementations.
- **Safety first:** File modifications, command execution, and process management have explicit safeguards.

Whether you run the commands yourself or ask an AI assistant to do the work, you can use the same toolkit.

## ✨ Why Cupbox?

### 01. Built for both developers and AI agents

Traditional command-line tools are primarily designed for humans. Cupbox also considers how AI agents discover and invoke tools.

Run a command directly:

```bash
cupbox organize ~/Downloads --mode category --dry-run
```

Or let a compatible MCP client call the corresponding tool:

```text
organize_files
```

Developers can continue using familiar terminal workflows, while AI agents can work through structured tool calls.

### 02. Safety is a default, not an afterthought

Giving AI access to local tools is useful, but incorrect file operations or system commands can have real consequences.

Cupbox incorporates safeguards into its design:

- File organization and batch renaming support dry-run previews.
- File-modification tools invoked through MCP default to dry-run mode.
- Command execution must pass an allowlist check: the AI-facing `run_command` **is denied by default** and requires `allowPrefixes` or an administrator-provided `CUPBOX_RUN_ALLOW`; in allowlist mode, shell metacharacters are rejected to prevent injection.
- Process termination requires both the PID and the expected process name.
- Name conflicts are skipped instead of silently overwriting existing files.
- Individual MCP tools can be disabled through an environment variable.

**Giving AI the ability to act does not mean giving it unrestricted authority.**

### 03. Lightweight dependencies

Cupbox aims to reuse existing operating-system capabilities instead of adding unnecessary dependencies.

- OCR: Native Windows recognition capabilities or an installed Tesseract executable.
- Archive operations: System `tar`, where supported by the implementation.
- Clipboard and screenshots: Platform-specific native capabilities.
- Runtime: Node.js 18.17 or later.
- Runtime dependencies: Designed to require only two direct runtime dependencies.

Actual availability depends on the operating system, installed components, and permissions.

### 04. Cross-platform workflows

Cupbox targets Windows, macOS, and Linux, making it suitable for personal development environments, project repositories, and everyday file operations.

Platform-specific tools, permissions, and system behavior may differ. Individual features should therefore be verified against the platform support and test results.

---

## 🧰 Features

Cupbox brings together 14 everyday utilities plus 2 AI capabilities (16 MCP tools in total). Every local capability has a CLI entry point and a corresponding MCP tool.

### 📁 File Management

| Feature | CLI | MCP Tool | Description |
|---|---|---|---|
| File organization | `cupbox organize` | `organize_files` | Organize files by type, date, or regular-expression rules, with preview support |
| Batch renaming | `cupbox rename` | `batch_rename` | Template-based and regex-based renaming, extension filters, and collision handling |
| File search | `cupbox search` | `search_files` | Search filenames and file contents while skipping common dependency directories |
| Archive management | `cupbox zip` | `zip` | Create archives, extract files, and inspect archive contents |

### 🔧 Text and Data Processing

| Feature | CLI | MCP Tool | Description |
|---|---|---|---|
| Hash calculation | `cupbox hash` | `hash` | Calculate MD5, SHA-1, SHA-256, and SHA-512 hashes |
| Timestamp conversion | `cupbox time` | `time_convert` | Detect seconds or milliseconds and convert timestamps to ISO, Beijing time, or relative time |
| Encoding and decoding | `cupbox codec` | `codec` | Base64, URL, and HTML encoding/decoding, plus JSON formatting and minification |
| CSV and JSON conversion | `cupbox csv` | `convert_csv_json` | Convert between CSV and JSON with RFC 4180-oriented CSV handling |

### 🖼️ Image Processing

| Feature | CLI | MCP Tool | Description |
|---|---|---|---|
| Pixel obfuscation | `cupbox obfuscate` | `obfuscate_image` | Scramble and losslessly restore PNG images across six modes, interoperable with the Tomato-Obfuscator ecosystem; invalid keys are rejected up front and existing files are never overwritten |

### 🖥️ System and Desktop Utilities

| Feature | CLI | MCP Tool | Description |
|---|---|---|---|
| OCR | `cupbox ocr` | `ocr_image` | Extract text using native Windows OCR or Tesseract |
| Clipboard | `cupbox clip` | `clipboard` | Read from and write to the clipboard |
| Screenshots | `cupbox shot` | `take_screenshot` | Capture screenshots and output PNG files |
| Protected command execution | `cupbox run` | `run_command` | Deny-by-default on the MCP side with a mandatory allowlist (injection-guarded), plus timeouts and output truncation |
| Process management | `cupbox proc` | `process` | Inspect processes and validate both PID and process name before termination |
| Update check | `cupbox update` | — | GitHub Releases → npm fallback (npm source verifies repository ownership to avoid name collisions); prints release notes and download URL; opt out with `CUPBOX_UPDATE_DISABLE=1` |

### 🧠 AI Capabilities

| Feature | CLI | MCP Tool | Description |
|---|---|---|---|
| AI chat | `cupbox ai ask` | `ai_ask` | Single-shot Q&A over your configured API (OpenAI-compatible / Anthropic) |
| AI agent | `cupbox ai agent` | `ai_agent` | Multi-turn loop: the model drives the local tools and summarizes the outcome |

### 🧩 Three-tier memory & context compaction (architecture inspired by [dsh-mnemon](https://github.com/omdsh-dev/dsh-mnemon))

The AI no longer starts from scratch every session: Cupbox keeps three memory tiers on your machine and automatically compacts long conversations into a summary.

| Tier | Storage | Behavior |
|---|---|---|
| Runtime memory | `Documents/Cupbox/memory/user.md` (profile) + `memory.md` (working agreements) | **Always injected** into the system prompt |
| Long-term facts | `Documents/Cupbox/memory/facts.jsonl` (append-only log) | **Recalled by relevance** (CJK bigram + Latin token scoring) |
| Project context | Session workspace + session summary | Workspace path stays in the prompt; the summary is AI-generated at compaction time |

**Context compaction**: when history exceeds the budget (default 24 000 characters), older turns are distilled by the model into a ≤400-character summary, keeping only the last 8 messages verbatim. The summary is merged into the system prompt and carries forward. Without an AI configuration it degrades to plain truncation and never blocks the chat. The desktop UI shows a "compacted N earlier messages" chip.

| Action | CLI | MCP Tool |
|---|---|---|
| Remember a fact | `cupbox memory add <text> [--source tag]` | `memory_remember` |
| Recall by keyword | `cupbox memory search <query>` | `memory_recall` |
| List / forget | `cupbox memory list` / `forget <id-or-keyword>` | `memory_manage` |
| Profile / agreements | `cupbox memory user [text]` / `collab [text]` | `memory_profile` |

In the desktop agent loop the model can call these four memory tools directly to remember things across sessions; relevant memories are auto-injected at the start of every conversation.

All CLI commands support `--json`, making their output easier to consume in scripts, automation pipelines, and other programs.

---

## 🚀 Quick Start

### Requirements

| Requirement | Details |
|---|---|
| Node.js | 18.17 or later |
| Package manager | npm |
| Operating systems | Windows / macOS / Linux |
| Optional components | System utilities required by specific features |

### Option 1: Install globally

```bash
npm install -g cupbox
```

Once installed, run Cupbox from your terminal:

```bash
cupbox help
```

### Option 2: Try it without a global installation

```bash
npx cupbox help
```

This is convenient if you want to explore Cupbox before installing it globally.

### Your first task: Organize a Downloads folder

Preview the planned changes:

```bash
cupbox organize ~/Downloads --mode category --dry-run
```

Review the results, then execute the operation:

```bash
cupbox organize ~/Downloads --mode category
```

An illustrative preview might look like this:

```text
photo.png   → Images/photo.png
report.pdf  → Documents/report.pdf

Preview complete: 2 items scheduled to move.
Dry-run enabled. No files were moved.
```

The output above is an example; actual paths, formatting, and summary messages depend on the implementation.

**Tip:** Always preview operations before modifying important directories.

---

## 💻 CLI Examples

### 1. Organize files

Sort your Downloads folder by file category:

```bash
cupbox organize ~/Downloads --mode category --dry-run
cupbox organize ~/Downloads --mode category
```

Available modes and rules can be checked with the command's help output.

### 2. Batch rename images

Add sequential numbers to image filenames:

```bash
cupbox rename ./photos --template "{n}-{name}" --ext "*.jpg" --dry-run
```

Review the proposed names before executing the operation.

### 3. Search a codebase

Find TODO markers in TypeScript files:

```bash
cupbox search ./src -c "TODO" --glob "*.ts"
```

Useful for locating pending work, configuration values, debugging clues, and code references.

### 4. Calculate hashes

```bash
cupbox hash --text "hello" --algo sha256,md5
```

Calculate hashes for text or files using the supported algorithms.

Note that MD5 and SHA-1 are not recommended when modern collision resistance is required. For integrity checks, prefer SHA-256 or SHA-512.

### 5. Convert timestamps

```bash
cupbox time 1700000000
```

Useful when debugging logs, inspecting API responses, or working with timestamp fields in databases.

### 6. Encode and decode data

```bash
cupbox codec b64e "Hello, world!"
```

Cupbox also provides utilities for URL encoding, HTML encoding, and JSON formatting.

### 7. Extract text from screenshots

```bash
cupbox ocr ./screenshot.png --lang eng
```

Useful for extracting text from error messages, application screenshots, and image-based documents.

Recognition quality and supported languages depend on the selected OCR engine and its installed language resources.

### 8. Work with archives

Use `cupbox zip` to create archives, extract files, and inspect archive contents.

To see the supported operations and parameters:

```bash
cupbox zip --help
```

When extracting archives, review the destination directory and archive paths carefully.

### 9. Execute protected commands

```bash
cupbox run --help
```

Cupbox provides command allowlisting, timeouts, and output truncation for supported command execution.

The commands that can run depend on the project's allowlist configuration. Cupbox should not be treated as an unrestricted shell executor.

### 10. Inspect and terminate processes

Check the available process-management options:

```bash
cupbox proc --help
```

To terminate a process, provide both its PID and expected process name:

```bash
cupbox proc kill --pid 1234 --name node
```

The PID shown here is only an example. Verify that the target process is correct before terminating it.

### 11. Pixel obfuscation and restoration

```bash
cupbox obfuscate ./photo.png --mode c --key my-secret
```

The scrambled image is saved as `photo.obf.png`. Restore it losslessly with the same mode and key plus `--decrypt`:

```bash
cupbox obfuscate ./photo.obf.png --mode c --key my-secret --decrypt
```

Run `cupbox obfuscate` without arguments to list all six modes. A wrong or missing key is rejected before any file is touched, and colliding output names are automatically renamed — existing files are never overwritten.

---

## 🤖 Connect Your AI

One of Cupbox's central goals is to make AI assistants useful beyond answering questions, allowing them to invoke real tools within defined boundaries.

Through the Model Context Protocol (MCP), compatible clients can discover and invoke Cupbox tools.

### Example use cases

You could ask your AI assistant:

> Organize my Downloads folder by file type. Show me a preview of every planned move before making any changes.

Or:

> Number these screenshots in order. Show me the proposed filenames first, and never overwrite existing files.

The assistant can select the relevant MCP tool, inspect the structured result, and proceed with the requested operation when appropriate.

### Built-in AI engine (direct API access, no MCP client required)

Cupbox ships a Codex-style AI capability usable from all three forms — CLI, desktop app, and MCP:

- **`cupbox ai ask`** — single-shot Q&A;
- **`cupbox ai agent`** — multi-turn agent loop: the model picks from the 14 local tools (files / data / images / protected commands) and summarizes at the end;
- MCP gains the `ai_ask` and `ai_agent` tools, callable from Claude Desktop / Cursor;
- The desktop app is a chat workbench: new chat / history sessions, one-click “Ask · Agent” mode switch, and API configuration in “Settings → API Settings”.

**First-time setup (once):**

```bash
# OpenAI-compatible providers (official / DeepSeek / Kimi / Ollama / OpenRouter / vLLM …)
cupbox ai config --provider openai-compatible --base https://api.deepseek.com/v1 --model deepseek-chat --key sk-xxx

# or Anthropic official
cupbox ai config --provider anthropic --model claude-sonnet-4-5 --key sk-ant-xxx
```

```bash
cupbox ai ask "What time is 1718000000"
cupbox ai agent "Find every TODO in this project and summarize them" --max-turns 6
cupbox ai config                 # show current config (key masked)
```

- The config lives in `Documents/Cupbox/config.json` (mode 0600; since v1.2.0 the OS Documents folder is the default, the legacy `~/.cupbox` migrates on first launch, `CUPBOX_HOME` still overrides); **the key stays on your machine and is never uploaded**;
- Env vars `CUPBOX_AI_API_KEY` / `CUPBOX_AI_BASE_URL` / `CUPBOX_AI_MODEL` / `CUPBOX_AI_PROVIDER` override the file;
- Inside the agent, `rename` / `organize` are **always dry-run previews** (8 rounds by default, 10 max) and `run` still requires an allowlist — **the AI never gets more permissions than a human user**.

### Option 1: Use a global installation

Install Cupbox:

```bash
npm install -g cupbox
```

Add the following to your MCP client's configuration file:

```json
{
  "mcpServers": {
    "cupbox": {
      "command": "cupbox",
      "args": ["mcp"]
    }
  }
}
```

Save the configuration and restart or refresh the MCP connection as required by your client.

### Option 2: Use npx

If you prefer not to install Cupbox globally, see the project's example configuration:

[`examples/npx-mcp-config.json`](./examples/npx-mcp-config.json)

The general startup command is:

```bash
npx -y cupbox mcp
```

The exact configuration format depends on your MCP client.

### What happens when AI calls a tool?

For file organization and batch renaming, MCP tools default to dry-run mode. This allows the assistant to inspect the proposed changes before requesting actual execution.

```text
User describes a task
        |
AI selects an MCP tool
        |
Cupbox validates the arguments
        |
A preview is returned
        |
The user confirms execution
        |
Cupbox validates and performs the operation
        |
The result is returned
```

The actual flow depends on each tool's parameters, implementation, and safety checks.

**Important:** Dry-run is not a transaction mechanism and does not guarantee that the filesystem will remain unchanged between preview and execution. Backups and final verification are still recommended for important data.

---

## 📦 Desktop app (Stage 1/3)

A local Electron desktop app rebuilt as a workbench (since v1.0.0):

- **Session sidebar** — new chat, persistent history (`Documents/Cupbox/sessions/`, deletable / clearable), and a **workspace directory picker** (Agent file tasks run inside the workspace).
- **Chat pane** — segmented “Ask / Agent” mode switch, Enter to send (Shift+Enter newline), tool-trace cards on replies, automatic multi-turn context.
- **Tool drawer** — the former 16-tool form UI folded into a right-side drawer, grouped by data / files / images / system, with dynamic forms and a result panel (pretty JSON, inline image preview).
- **Settings modal** — four tabs: **API settings** (protocol / base URL / model / key / temperature / agent rounds), **Theme** (dark · light · follow-system × aurora / mint / amber / rose, applied instantly and persisted), **Plugins** (each tool toggle affects both drawer visibility and the Agent's callable tool set), and **About & Updates** (version info, one-click **check the GitHub repository** for new releases with inline results, plus repository / Releases / CHANGELOG shortcuts).
- **Update check & release announcement** (v1.0.1) — a silent startup check lights up a breathing "vX.Y.Z available" badge in the title bar and pops a one-time announcement (version diff + release notes + **Download on GitHub** / View changelog / Remind later); click the version chip or use **Settings → About & Updates** for a manual check, dismissed versions stay reachable from the badge, `CUPBOX_UPDATE_DISABLE=1` turns checking off.
- **Data defaults to your Documents folder** (v1.2.0) — config / keys / model library / sessions / memory all live in `Documents/Cupbox`; the **API storage card** in Settings → Model connection opens the folder or reveals `config.json` in one click. The legacy `~/.cupbox` migrates on first launch (copy-only, never overwrites; `CUPBOX_HOME` overrides), and the sidebar **Model management** entry jumps straight to multi-model + capability multi-select.
- **Live tool-call stream + assistant bubbles** (v1.2.0) — while the agent runs a task each tool call appears as a card in real time (name / args / executing animation → duration or failure detail), then the final message's full trace takes over; assistant replies are now bubble cards mirroring the user's, with an entrance animation.

It shares the exact same engines and safety defaults as the CLI and MCP server (dry-run, allowlists, and extraction pre-flights all active).

```bash
npm install          # first run downloads the Electron runtime through the npmmirror mirror
npm run desktop      # run in development
npm run pack:exe     # build a portable exe → release/Cupbox可视化/Cupbox可视化.exe
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the three-stage roadmap (tool cockpit → multi-engine ACP integration → skills marketplace / scheduling / multi-session) and the rationale behind each choice.

---

## 🛡️ Security by Design

Cupbox is designed to make AI-assisted automation more controlled and predictable.

| Risk | Safeguard | Purpose |
|---|---|---|
| Unintended file moves | Dry-run previews | Inspect the planned changes before execution |
| Batch rename conflicts | Preview and collision handling | Reduce accidental overwrites |
| AI command execution | Deny-by-default, explicit allowlist required | Refuses to run without `allowPrefixes` or `CUPBOX_RUN_ALLOW`; shell metacharacters are rejected in allowlist mode to prevent injection |
| Long-running commands | Timeout controls | Prevent commands from waiting indefinitely |
| Excessive command output | Output truncation | Limit the size of returned results |
| Extracting untrusted zips | Pre-flight entry checks before extraction | Prevent zip-slip (`../` traversal) and silent overwrites of existing files |
| Incorrect process termination | PID and process-name validation | Reduce the risk of terminating the wrong process |
| Unnecessary AI capabilities | MCP tool disabling | Reduce the available tool surface |

### Disable specific MCP tools

Cupbox supports disabling selected tools through an environment variable:

```bash
CUPBOX_DISABLE_TOOLS=run_command,process cupbox mcp
```

This example illustrates the intended configuration. Environment-variable syntax differs between shells and operating systems. On Windows, configure the variable in the environment used to launch the MCP server.

Relatedly, `CUPBOX_RUN_ALLOW=npm,git status` pre-configures the allowed command prefixes for `run_command` (a call-site `allowPrefixes` takes precedence). With neither in place, the MCP-side `run_command` refuses to execute anything.

### Understanding the security boundaries

Several limitations are important to understand:

- An allowlist is not a complete operating-system sandbox.
- In allowlist mode, commands containing shell metacharacters (pipes, redirection, command substitution, cmd variable expansion) are rejected — this is an injection guard, not a bug; run pipes or redirection yourself from the CLI without an allowlist when needed.
- Zip extraction pre-flights traversal entries and overwrite conflicts before extracting; when unpacking untrusted archives yourself via the CLI, still verify their origin first.
- An allowed program may still have access to files and system resources permitted to its operating-system account.
- PID and process-name validation reduce certain risks but cannot eliminate all process races.
- A dry-run preview may become stale if files change before execution.
- Sensitive workflows should still follow the principle of least privilege.

If Cupbox is used on an automation server or by an AI agent with elevated privileges, consider additional operating-system permissions, workspace restrictions, command auditing, and environment isolation.

---

## ⚙️ Platform Support and Dependencies

Cupbox aims to remain lightweight by reusing available system capabilities. Some features depend on platform-specific tools and permissions.

| Feature | Dependencies or limitations |
|---|---|
| Core CLI and MCP | Node.js runtime |
| OCR | Native Windows OCR capabilities or an installed Tesseract executable |
| Archive operations | The system archive utility required by the implementation |
| Clipboard | Platform-specific capabilities and permissions |
| Screenshots | Platform-specific implementation and permissions |
| Pixel obfuscation | PNG encoding/decoding via the pure-JS [pngjs](https://github.com/pngjs/pngjs) library, no native dependencies |
| Process management | Operating-system permissions and process-management behavior |

If a feature does not work in your environment, check the relevant system components, permissions, and command help before opening an issue.

Please include your operating system, Node.js version, reproduction steps, and relevant error output when reporting a problem.

---

## 📚 Documentation and Support

- **CLI help:** Run `cupbox help` in your terminal.
- **npm package:** [cupbox](https://www.npmjs.com/package/cupbox).
- **GitHub repository:** [beizilaoshi/cupbox](https://github.com/beizilaoshi/cupbox).
- **Chinese documentation:** [README.md](./README.md).
- **MCP configuration examples:** [`examples/`](./examples/).
- **Bug reports and feature requests:** [GitHub Issues](https://github.com/beizilaoshi/cupbox/issues).

If you are unfamiliar with a command, start with its help output before running operations on real files.

---

## ⚙️ Development

Contributions are welcome. Here's how to set up a local development environment.

### Clone the repository

```bash
git clone https://github.com/beizilaoshi/cupbox.git
cd cupbox
npm ci
```

### Run the tests

```bash
npm test
```

The project's test workflow covers the build, unit tests, CLI smoke tests, and MCP integration tests using in-memory transport.

### Start development mode

```bash
npm run dev
```

### Project structure

```text
cupbox/
├── src/
│   ├── core/       # Core functionality
│   ├── util/       # Platform, process, and filesystem utilities
│   ├── index.ts    # CLI entry point
│   └── mcp.ts      # MCP server entry point
├── test/           # Automated tests
├── examples/       # MCP configuration examples
├── README.md
└── README.en.md
```

### Continuous integration

The existing CI configuration covers Windows and Ubuntu across Node.js 18, 20, and 22.

The goal is to catch cross-platform differences, runtime compatibility issues, and regressions early.

---

## 🤝 Contributing

Cupbox has plenty of room to grow. Bug reports, feature requests, documentation improvements, and pull requests are all welcome.

Contributions are especially valuable in the following areas:

- **Cross-platform compatibility:** Paths, encoding, permissions, and system utility differences.
- **Security:** Argument validation, edge cases, error handling, and security testing.
- **Test coverage:** File operations, invalid inputs, collision scenarios, and MCP integration.
- **Developer experience:** Clearer help messages, better errors, and consistent structured output.
- **Documentation:** Usage examples, troubleshooting guides, and platform-specific setup instructions.

Before submitting a pull request, please run:

```bash
npm test
```

Whenever possible, include reproducible test cases and describe the motivation, expected behavior, and potential compatibility impact of your changes.

---

## 🗺️ Project Direction

Cupbox aims to become a lightweight, reliable toolbox for both human developers and AI agents.

Potential areas for continued improvement include:

- **Reliability:** Expand edge-case coverage, error handling, and cross-platform testing.
- **Security:** Continue reviewing command execution, path handling, and file modification boundaries.
- **Composability:** Keep CLI, MCP, and script-based workflows consistent and predictable.
- **Maintainability:** Preserve clear module boundaries while keeping dependency growth under control.
- **Usability:** Improve diagnostics, examples, and environment troubleshooting.

These are development directions, not a claim that every item has already been implemented.

---

## 🙏 Acknowledgements

The six pixel-obfuscation modes behind `obfuscate` / `obfuscate_image` are ported from the open-source project "番茄图片混淆 桌面版 / Tomato Image Obfuscator Desktop" ([MIT License, Copyright (c) 2026 3450892121](https://github.com/3450892121), author's GitHub profile: [github.com/3450892121](https://github.com/3450892121)). The port was byte-for-byte cross-checked against the original engine, and compatibility golden tests are kept in the test suite to preserve long-term interoperability with that project and its mobile ecosystem. Thanks to the original author for open-sourcing it.

The architecture of the three-tier memory and context compaction (the `memory` subcommand, the `memory_*` tools, and session summaries) is inspired by the runtime-memory / long-term-fact / turn-compaction model of the open-source project [dsh-mnemon](https://github.com/omdsh-dev/dsh-mnemon) by omdsh-dev. Cupbox ships its own standalone rewrite built for a local CLI/desktop context (Node built-ins only, zero extra runtime dependencies). Thanks to the original author for the architectural inspiration.

---

## 📄 License

Cupbox is open source under the [MIT License](./LICENSE).

You may use, modify, and distribute the project under the terms of that license. Please refer to the repository's license file for the full terms.

---

<p align="center">
  <strong>Cupbox — Less busywork, more building.</strong>
</p>

<p align="center">
  Spend less time writing throwaway scripts and repeating routine operations.<br>
  Spend more time building things that matter.
</p>
