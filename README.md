# Rosalind for VS Code

Solve [Rosalind.info](https://rosalind.info) computational biology problems without leaving your editor. Browse the full problem list, read problems with rendered math, download timed datasets, and submit answers, all from the VS Code sidebar.

---

## Features

### Browse & Read Problems
Click **Open Problem** in the sidebar to pick from the full Rosalind problem catalogue. The problem loads directly in the sidebar panel with two tabs:

- **Problem: **the task statement, sample dataset, and sample output, with math rendered via KaTeX
- **Biological Context: ** the introductory biology background for the problem

Both are colelcted from rosalind.info

### Timed Dataset Timer
Click **Start Dataset Timer** to download your personal dataset for the currently open problem and start a 5-minute countdown in the status bar. The dataset file opens automatically in your workspace. When the timer expires, the file is deleted and you receive a notification.

### Submit Solutions
Click **Submit Solution** to send your answer to Rosalind. You can either paste the output directly or pick a `.txt` file from disk. The extension reports whether your answer was correct or incorrect via a VS Code notification.

### Sign In Once, Stay Signed In
Your session is encrypted and stored in VS Code's native Secret Storage, you only sign in once per machine. The session survives VS Code restarts indefinitely.

---

## Sign In

### Automatic (Chrome, Brave, Edge, Arc, Vivaldi, Opera, Chromium)
If you are already signed in to Rosalind in any supported Chromium-based browser, click **Sign In with Browser**. The extension reads your session cookie directly from your browser's local cookie store.

> **Note:** macOS will show a Keychain access prompt the first time. This is required to decrypt the browser's cookie database and is read-only.

### Safari / Manual fallback
If you use Safari or the automatic method does not work:
1. Click **Paste Session Key** in the sidebar.
2. Follow the on-screen instructions to copy your `sessionid` cookie value from Safari's Web Inspector.
3. Paste it into the input box.

Your session is verified immediately and stored securely.

### Google / OpenID accounts
Sign in to Rosalind in your browser first (via Google or any provider), then use **Sign In with Browser** or **Paste Session Key** as described above. Username and password are never required.

---

## Requirements

| | Requirement |
|---|---|
| **VS Code** | 1.85 or later |
| **Auto sign-in** | macOS only (Keychain access required) |
| **Manual sign-in** | Any platform |
| **Rosalind account** | Free at [rosalind.info/accounts/register](https://rosalind.info/accounts/register/) |

> On **Windows** and **Linux**, use the **Paste Session Key** command to sign in. Automatic browser cookie extraction is currently macOS-only.

---

## Commands

All commands are accessible from the **Rosalind** panel in the activity bar or via the Command Palette (`Cmd+Shift+P`).

| Command | Description |
|---|---|
| `Rosalind: Sign In with Browser` | Auto-import session from Chrome, Brave, Edge, Arc, Vivaldi, Opera, or Chromium |
| `Rosalind: Paste Session Key` | Manual sign-in by pasting a `sessionid` cookie value |
| `Rosalind: Sign Out` | Clear the stored session |
| `Rosalind: Open Problem` | Browse and open a problem in the sidebar |
| `Rosalind: Start Dataset Timer` | Download your dataset and start a 5-minute timer |
| `Rosalind: Submit Solution` | Submit your answer for the current problem |
| `Rosalind: Create Account` | Open the Rosalind registration page in your browser |

---

## Privacy

The extension communicates only with `rosalind.info`. Your session cookie is stored locally in VS Code's encrypted Secret Storage and is never sent anywhere else. No telemetry is collected.
