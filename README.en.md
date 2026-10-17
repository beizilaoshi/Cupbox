# cupbox

[![CI](https://github.com/beizilaoshi/cupbox/actions/workflows/ci.yml/badge.svg)](https://github.com/beizilaoshi/cupbox/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/cupbox.svg)](https://www.npmjs.com/package/cupbox)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![node](https://img.shields.io/node/v/cupbox.svg)](https://nodejs.org)

**Chores in, done out.** One package that installs as a **CLI** for humans and as an **MCP server** for AI agents (Claude Desktop / Cursor / Cline) — 13 everyday dev chores, zero config.

> 📖 **中文文档（默认）：[README.md](./README.md)**

## Why another toolbox?

- **You type it, or your AI does.** Every capability ships twice: `cupbox organize` for the terminal, `organize_files` for your AI client. Same engine, same safety rules.
- **AI-safe by design.** Destructive operations **default to dry-run previews** when driven by an AI; command execution sits behind an allowlist; killing a process requires PID **and** name to match. Your agent can be helpful without being dangerous.
- **No batteries to install.** OCR uses Windows' built-in engine (or `tesseract` if you have it), zips use the system `tar`, clipboard/screenshot use native APIs. Only **two** runtime dependencies in total.
- **Cross-platform.** Windows / macOS / Linux, Node ≥ 18.17.

## What's inside (13 tools)

| Chore | CLI | MCP tool | Notes |
|---|---|---|---|
| Organize files | `cupbox organize` | `organize_files` | by type / date / regex, dry-run first |
| Batch rename | `cupbox rename` | `batch_rename` | templates `{n}-{name}`, regex, collision-safe |
| Search | `cupbox search` | `search_files` | filenames + contents, skips `node_modules` |
| Hash | `cupbox hash` | `hash` | md5 / sha1 / sha256 / sha512, text or file |
| Time convert | `cupbox time` | `time_convert` | auto-detects s/ms, ISO, UTC+8, relative |
| Encode / decode | `cupbox codec` | `codec` | base64, URL, HTML, JSON format/minify |
| CSV ⇄ JSON | `cupbox csv` | `convert_csv_json` | RFC 4180, delimiter sniffing |
| OCR | `cupbox ocr` | `ocr_image` | Windows native / tesseract, Chinese OK |
| Clipboard | `cupbox clip` | `clipboard` | read / write |
| Screenshot | `cupbox shot` | `take_screenshot` | native, PNG |
| Zip | `cupbox zip` | `zip` | create / extract / list, UTF-8 names |
| Run a command | `cupbox run` | `run_command` | allowlist + timeout + output truncation |
| Processes | `cupbox proc` | `process` | list by memory, kill by pid **+** name |

Every CLI command accepts `--json` for scripting.

## Install

```bash
npm install -g cupbox      # global CLI
# or try it without installing:
npx cupbox help
```

## CLI quick tour

```bash
# Preview a folder cleanup, then apply it
cupbox organize ~/Downloads --mode category --dry-run
cupbox organize ~/Downloads --mode category

#  📋 report.pdf  →  Documents/report.pdf
#  📋 photo.png   →  Images/photo.png
#  📋 预览完毕（未执行），共 2 项将移动。去掉 --dry-run 执行。

# Number your holiday photos safely
cupbox rename ./photos --template "{n}-{name}" --ext *.jpg --dry-run

# Find every TODO in a repo (skips node_modules/.git)
cupbox search ./src -c "TODO" --glob *.ts

# Timestamps, hashes, codecs — the boring stuff done right
cupbox time 1700000000
cupbox hash --text "hello" --algo sha256,md5
cupbox codec b64e "你好，世界"

# OCR a screenshot (Windows built-in engine, Chinese supported)
cupbox ocr ./截图.png --lang zh-Hans

# Kill a process only if the name matches too
cupbox proc kill --pid 1234 --name node
```

## Connect it to your AI (MCP)

Add to your MCP client config (e.g. `claude_desktop_config.json`):

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

No global install? Use `npx -y cupbox mcp` instead — see [`examples/npx-mcp-config.json`](./examples/npx-mcp-config.json).

Then just talk to your agent:

> "Organize my Downloads folder by file type — **show me a preview first**."
> "Rename these screenshots with running numbers, don't touch the originals until I confirm."

The agent will call `organize_files` / `batch_rename`, which **default to dry-run**, hand you the preview, and only execute when you say so.

### Guardrails

| Situation | cupbox's answer |
|---|---|
| AI asks to move/rename files | Preview first (`dryRun` defaults to `true` for AI) |
| AI asks to run a shell command | Must pass an allowlist of command prefixes; timeout + output truncation built in |
| AI asks to kill a process | PID **and** expected process name must both match |
| A rename collides with an existing file | Skipped with a reason — never silently overwritten |
| You want fewer MCP tools exposed | `CUPBOX_DISABLE_TOOLS=run_command,process cupbox mcp` |

## Documentation

- `cupbox help` — full command reference in your terminal
- [中文文档（默认）](./README.md)
- MCP config examples: [`examples/`](./examples/)

## Development

```bash
git clone https://github.com/beizilaoshi/cupbox.git
cd cupbox
npm ci
npm test        # builds + runs the full suite (unit, CLI smoke, MCP over in-memory transport)
npm run dev     # tsc watch mode
```

Project layout: `src/core` (features) · `src/util` (platform/process/fs helpers) · `src/index.ts` (CLI) · `src/mcp.ts` (MCP server) · `test/` (vitest).

CI runs the suite on **Windows + Ubuntu × Node 18/20/22**.

## Contributing

Issues and PRs welcome — especially platform-specific edge cases (paths, encodings, tool availability). Please keep `npm test` green.

## License

[MIT](./LICENSE)
