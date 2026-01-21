# Claude Code Monitor CLI

[![npm version](https://img.shields.io/npm/v/claude-code-monitor.svg)](https://www.npmjs.com/package/claude-code-monitor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![macOS](https://img.shields.io/badge/platform-macOS-lightgrey.svg)](https://www.apple.com/macos/)

**A CLI tool to monitor multiple Claude Code sessions in real-time from your terminal.**

<p align="center">
  <img src="https://raw.githubusercontent.com/onikan27/claude-code-monitor/main/docs/ccm-demo.gif" alt="Claude Code Monitor Demo" width="1000">
</p>

---

## 📑 Table of Contents

- [✨ Features](#-features)
- [📱 Mobile Web Interface](#-mobile-web-interface)
- [📋 Requirements](#-requirements)
- [🚀 Installation](#-installation)
- [⚡ Quick Start](#-quick-start)
- [📖 Commands](#-commands)
- [⌨️ Keybindings](#️-keybindings-watch-mode)
- [🎨 Status Icons](#-status-icons)
- [🖥️ Supported Terminals](#️-supported-terminals)
- [💾 Data Storage](#-data-storage)
- [📦 Programmatic Usage](#-programmatic-usage)
- [🔧 Troubleshooting](#-troubleshooting)
- [🔒 Security](#-security)
- [⚠️ Disclaimer](#️-disclaimer)
- [📝 Changelog](#-changelog)
- [📄 License](#-license)

---

## ✨ Features

- 🔌 **Serverless** - File-based session state management (no API server required)
- 🔄 **Real-time** - Auto-updates on file changes
- 🎯 **Tab Focus** - Instantly switch to the terminal tab of a selected session
- 🎨 **Simple UI** - Displays only status and directory
- ⚡ **Easy Setup** - One command `ccm` for automatic setup and launch
- 📱 **Mobile Web** - Monitor and control sessions from your smartphone

---

## 📱 Mobile Web Interface

Monitor Claude Code sessions from your smartphone.

### Features

- 📊 Real-time session status via WebSocket
- 💬 View latest Claude messages
- 🎯 Focus terminal sessions remotely
- ✉️ Send text messages to terminal

### Usage

1. Run `ccm` or `ccm --qr` to start monitoring
2. Press `h` to show QR code
3. Scan QR code with your smartphone

### Standalone Server

Run web server without TUI:

```bash
ccm serve           # Default port 3456
ccm serve -p 8080   # Custom port
```

### Security

> **Important**: Your smartphone and Mac must be on the **same Wi-Fi network**.

- **Token Authentication**: Each session generates a unique authentication token included in the URL
- **Local Network Only**: The server is only accessible within your local network
- **Do not share the URL**: The URL contains an authentication token - treat it like a password

---

## 📋 Requirements

> **Note**: This tool is **macOS only** due to its use of AppleScript for terminal focus features.

- **macOS** (focus feature is macOS only)
- **Node.js** >= 18.0.0
- **Claude Code** installed

---

## 🚀 Installation

### Global install (Recommended)

```bash
npm install -g claude-code-monitor
```

### Run with npx (no install required)

```bash
npx claude-code-monitor
```

> **Note**: With npx, you must run `npx claude-code-monitor` each time (the `ccm` shortcut is only available with global install). Global install is recommended since this tool requires hook setup and is designed for continuous use.

---

## ⚡ Quick Start

```bash
ccm
```

On first run, it automatically sets up hooks and launches the monitor.

---

## 📖 Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `ccm` | - | Launch monitor TUI (auto-setup if not configured) |
| `ccm watch` | `ccm w` | Launch monitor TUI |
| `ccm serve` | `ccm s` | Start web server for mobile monitoring |
| `ccm setup` | - | Configure Claude Code hooks |
| `ccm list` | `ccm ls` | List sessions |
| `ccm clear` | - | Clear all sessions |
| `ccm --version` | `ccm -V` | Show version |
| `ccm --help` | `ccm -h` | Show help |
| `ccm --qr` | - | Launch monitor with QR code visible |

---

## ⌨️ Keybindings (watch mode)

| Key | Action |
|-----|--------|
| `↑` / `k` | Move up |
| `↓` / `j` | Move down |
| `Enter` / `f` | Focus selected session |
| `1-9` | Quick select & focus by number |
| `h` | Show/Hide QR code for mobile access |
| `c` | Clear all sessions |
| `q` / `Esc` | Quit |

---

## 🎨 Status Icons

| Icon | Status | Description |
|------|--------|-------------|
| `●` | Running | Claude Code is processing |
| `◐` | Waiting | Waiting for user input (e.g., permission prompt) |
| `✓` | Done | Session ended |

---

## 🖥️ Supported Terminals

Focus feature works with the following terminals:

| Terminal | Focus Support | Notes |
|----------|--------------|-------|
| iTerm2 | ✅ Full | TTY-based window/tab targeting |
| Terminal.app | ✅ Full | TTY-based window/tab targeting |
| Ghostty | ⚠️ Limited | Activates app only (cannot target specific window/tab) |

> **Note**: Other terminals (Alacritty, kitty, Warp, etc.) can use monitoring but focus feature is not supported.

---

## 💾 Data Storage

Session data is stored in `~/.claude-monitor/sessions.json`.

### What is stored

| Field | Description |
|-------|-------------|
| `session_id` | Claude Code session identifier |
| `cwd` | Working directory path |
| `tty` | Terminal device path (e.g., `/dev/ttys001`) |
| `status` | Session status (running/waiting_input/stopped) |
| `updated_at` | Last update timestamp |

Data is automatically removed after 30 minutes of inactivity or when the terminal session ends.

---

## 📦 Programmatic Usage

Can also be used as a library:

```typescript
import { getSessions, getStatusDisplay } from 'claude-code-monitor';

const sessions = getSessions();
for (const session of sessions) {
  const { symbol, label } = getStatusDisplay(session.status);
  console.log(`${symbol} ${label}: ${session.cwd}`);
}
```

---

## 🔧 Troubleshooting

### Sessions not showing

1. Run `ccm setup` to verify hook configuration
2. Check if `~/.claude/settings.json` contains hook settings
3. Restart Claude Code

```bash
# Check configuration
cat ~/.claude/settings.json | grep ccm
```

### Focus not working

1. Verify you're using macOS
2. Verify you're using iTerm2, Terminal.app, or Ghostty
3. Check System Preferences > Privacy & Security > Accessibility permissions

### Reset session data

```bash
ccm clear
# or
rm ~/.claude-monitor/sessions.json
```

---

## 🔒 Security

- **No data sent to external servers** - All session data stays on your machine
- This tool modifies `~/.claude/settings.json` to register hooks
- Focus feature uses AppleScript to control terminal applications
- **Mobile Web**: Token-based authentication, accessible only on local network (same Wi-Fi required)

---

## ⚠️ Disclaimer

This is an unofficial community tool and is not affiliated with, endorsed by, or associated with Anthropic.
"Claude" and "Claude Code" are trademarks of Anthropic.

---

## 📝 Changelog

See [CHANGELOG.md](./CHANGELOG.md) for a list of changes.

---

## 📄 License

MIT

---

<p align="center">Made with ❤️ for the Claude Code community</p>
