# Claude Code Monitor

[![npm version](https://img.shields.io/npm/v/claude-code-monitor.svg)](https://www.npmjs.com/package/claude-code-monitor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![macOS](https://img.shields.io/badge/platform-macOS-lightgrey.svg)](https://www.apple.com/macos/)

**Monitor multiple Claude Code sessions in real-time from your terminal or smartphone.**

### Terminal UI
Monitor sessions with keyboard navigation

<p align="center">
  <img src="https://raw.githubusercontent.com/onikan27/claude-code-monitor/main/docs/ccm-demo.gif" alt="Terminal UI Demo" width="800">
</p>

### Mobile Web
Control from your phone (same Wi-Fi required)

<p align="center">
  <img src="https://raw.githubusercontent.com/onikan27/claude-code-monitor/main/docs/mobile-web-demo.gif" alt="Mobile Web Demo" width="800">
</p>

---

## ✨ Features

| Terminal (TUI) | Mobile Web |
|----------------|------------|
| Real-time session monitoring | Monitor from your smartphone |
| Quick tab focus with keyboard | Remote terminal focus |
| Vim-style navigation | Send messages to terminal |
| Simple status display | Real-time sync via WebSocket |

- 🔌 **Serverless** - File-based state management, no API server required
- ⚡ **Easy Setup** - One command `ccm` for automatic setup and launch
- 🔒 **Secure** - No external data transmission, token-based mobile auth

---

## 📋 Requirements

> **Note**: This tool is **macOS only** due to its use of AppleScript for terminal control.

- **macOS**
- **Node.js** >= 18.0.0
- **Claude Code** installed

---

## 🚀 Quick Start

### Install

```bash
npm install -g claude-code-monitor
```

### Run

```bash
ccm
```

On first run, it automatically sets up hooks and launches the monitor.

### Mobile Access

1. Press `h` to show QR code
2. Scan with your smartphone (same Wi-Fi required)

---

## 📖 Usage

### Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `ccm` | - | Launch monitor (auto-setup if needed) |
| `ccm watch` | `ccm w` | Launch monitor |
| `ccm serve` | `ccm s` | Start mobile web server only |
| `ccm setup` | - | Configure Claude Code hooks |
| `ccm list` | `ccm ls` | List sessions |
| `ccm clear` | - | Clear all sessions |

### Keybindings

| Key | Action |
|-----|--------|
| `↑` / `k` | Move up |
| `↓` / `j` | Move down |
| `Enter` / `f` | Focus selected session |
| `1-9` | Quick select & focus |
| `h` | Show/Hide QR code |
| `c` | Clear all sessions |
| `q` / `Esc` | Quit |

### Status Icons

| Icon | Status | Description |
|------|--------|-------------|
| `●` | Running | Claude Code is processing |
| `◐` | Waiting | Waiting for user input |
| `✓` | Done | Session ended |

---

## 📱 Mobile Web Interface

Monitor and control Claude Code sessions from your smartphone.

### Features

- Real-time session status via WebSocket
- View latest Claude messages
- Focus terminal sessions remotely
- Send text messages to terminal

### Security

> **Important**: Your smartphone and Mac must be on the **same Wi-Fi network**.

- **Token Authentication** - Each session generates a unique token
- **Local Network Only** - Not accessible from the internet
- **Do not share the URL** - Treat it like a password

---

## 🖥️ Supported Terminals

| Terminal | Focus Support | Notes |
|----------|--------------|-------|
| iTerm2 | ✅ Full | TTY-based targeting |
| Terminal.app | ✅ Full | TTY-based targeting |
| Ghostty | ⚠️ Limited | App activation only |

> Other terminals can use monitoring, but focus feature is not supported.

---

## 🔧 Troubleshooting

### Sessions not showing

1. Run `ccm setup` to verify hook configuration
2. Check `~/.claude/settings.json` for hook settings
3. Restart Claude Code

### Focus not working

1. Verify you're using a supported terminal
2. Check System Preferences > Privacy & Security > Accessibility

### Reset data

```bash
ccm clear
```

---

## 🔒 Security

- **No data sent to external servers** - All data stays on your machine
- Hook registration modifies `~/.claude/settings.json`
- Focus feature uses AppleScript for terminal control
- Mobile Web uses token authentication on local network only

---

## 📦 Programmatic Usage

```typescript
import { getSessions, focusSession } from 'claude-code-monitor';

const sessions = getSessions();
if (sessions[0]?.tty) {
  focusSession(sessions[0].tty);
}
```

---

## ⚠️ Disclaimer

This is an unofficial community tool and is not affiliated with Anthropic.
"Claude" and "Claude Code" are trademarks of Anthropic.

---

## 📝 Changelog

See [CHANGELOG.md](./CHANGELOG.md) for details.

---

## 📄 License

MIT

---

<p align="center">Made with ❤️ for the Claude Code community</p>
