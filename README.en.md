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
  One toolkit, three ways to work.<br>
  A practical command-line toolbox for developers, an MCP server for AI agents,<br>
  and a portable visual desktop app.
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

### One toolkit. Three interfaces.

```text
                       Cupbox
                          |
                +---------+---------+---------+
                |            |            |
             CLI        MCP Server    Desktop App
                |            |            |
        Direct developer use   AI agent access   Double-click
                |            |            |
                +---------+---------+---------+
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
- **Desktop (new in 1.0.1):** A portable, offline-capable visual app that runs by double-clicking and follows the same safety rules.
- **Shared core:** All three interfaces reuse the same underlying functionality instead of maintaining separate implementations.
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
- Command execution must pass an allowlist check.
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

Cupbox brings together 16 everyday utilities: the original 13, plus reversible image-pixel obfuscation and two AI orchestration capabilities. Every feature is reachable from the CLI, from MCP, or from the desktop app (`cupbox update`, the version checker, is CLI-only).

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

### 🖥️ System and Desktop Utilities

| Feature | CLI | MCP Tool | Description |
|---|---|---|---|
| OCR | `cupbox ocr` | `ocr_image` | Extract text using native Windows OCR or Tesseract |
| Clipboard | `cupbox clip` | `clipboard` | Read from and write to the clipboard |
| Screenshots | `cupbox shot` | `take_screenshot` | Capture screenshots and output PNG files |
| Protected command execution | `cupbox run` | `run_command` | Command-prefix allowlisting, timeouts, and output truncation |
| Process management | `cupbox proc` | `process` | Inspect processes and validate both PID and process name before termination |

### 🖼️ Images and AI

| Feature | CLI | MCP Tool | Description |
|---|---|---|---|
| Image-pixel obfuscation | `cupbox obfuscate` | `obfuscate_image` | Reversible six-mode obfuscation, verified byte-for-byte against golden vectors |
| AI assistant | `cupbox ai ask` | `ai_ask` | Read-only Q&A through OpenAI-compatible or Anthropic APIs |
| AI agent | `cupbox ai agent` | `ai_agent` | Multi-turn tool orchestration; file operations are forced into dry-run, commands still require the allowlist |

All CLI commands support `--json`, making their output easier to consume in scripts, automation pipelines, and other programs.

---

## 🆕 What's New in 1.0.1

- **AI toolbox:** `cupbox ai ask / agent / config`; new MCP tools `ai_ask` and `ai_agent` (tool count 14 → 16); the agent defaults to 8 turns and **never gains more authority than a human user**.
- **Visual desktop app (stage 1/3):** A portable Electron app — no installation, works offline — see [`desktop/`](./desktop/).
- **Image-pixel obfuscation:** The 14th engine tool; six reversible modes, byte-for-byte compatible with the "Tomato Image Obfuscation" engine.
- **Update announcements:** CLI `cupbox update` plus a desktop update dialog, sourced from a custom manifest → GitHub Releases → npm.
- **Security hardening:** `run_command` is now deny-by-default with shell-injection interception; zip-slip and overwrite pre-checks; PNG decompression-bomb protection.

See [CHANGELOG.en.md](./CHANGELOG.en.md) for the full list of changes.

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

## 🛡️ Security by Design

Cupbox is designed to make AI-assisted automation more controlled and predictable.

| Risk | Safeguard | Purpose |
|---|---|---|
| Unintended file moves | Dry-run previews | Inspect the planned changes before execution |
| Batch rename conflicts | Preview and collision handling | Reduce accidental overwrites |
| AI command execution | Command-prefix allowlist | Restrict the commands that can be invoked |
| Long-running commands | Timeout controls | Prevent commands from waiting indefinitely |
| Excessive command output | Output truncation | Limit the size of returned results |
| Incorrect process termination | PID and process-name validation | Reduce the risk of terminating the wrong process |
| Unnecessary AI capabilities | MCP tool disabling | Reduce the available tool surface |
| AI executing arbitrary commands | `run_command` is deny-by-default; explicit allowlist plus injection interception | Nothing runs unless it was declared |
| Extracting untrusted archives | zip-slip path-traversal and overwrite pre-checks | Prevent directory traversal and silent overwrites |

### Disable specific MCP tools

Cupbox supports disabling selected tools through an environment variable:

```bash
CUPBOX_DISABLE_TOOLS=run_command,process cupbox mcp
```

This example illustrates the intended configuration. Environment-variable syntax differs between shells and operating systems. On Windows, configure the variable in the environment used to launch the MCP server.

### Understanding the security boundaries

Several limitations are important to understand:

- An allowlist is not a complete operating-system sandbox.
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
├── desktop/        # Portable desktop app (Electron)
├── docs/           # Architecture documentation
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
