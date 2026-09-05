# Random Review — Obsidian Random Note Review Plugin

[![简体中文](https://img.shields.io/badge/简体中文-README-blue)](./README.md)  [![Obsidian](https://img.shields.io/badge/Obsidian-Plugin-purple.svg)](https://obsidian.md)  [![Release](https://img.shields.io/github/v/release/ktlamors/obsidian-random-review)](https://github.com/ktlamors/obsidian-random-review/releases)  [![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)  [![Last Commit](https://img.shields.io/github/last-commit/ktlamors/obsidian-random-review)](https://github.com/ktlamors/obsidian-random-review)

Randomly select notes from specified folders with tag and property filtering, browse them fullscreen with answer toggle, and export results to HTML, Markdown, plain text, or Word. Ideal for flashcard review, random browsing, and quiz simulation.

## Features

- **🎲 Random Extraction** — Pick notes randomly from a target folder with configurable count
- **🏷️ Tag Filtering** — Include or exclude notes by tags (OR logic)
- **📋 Property Filtering** — Filter into AND condition groups with per-group pick counts; different groups are alternatives (OR)
- **📂 Folder Exclusion** — Exclude specific sub-folders from extraction
- **👁 Answer Toggle** — Expand/collapse folded callouts (`> [!NOTE]-`) with one click
- **✏️ Edit While Reviewing** — Open notes in a split pane for editing, auto-refresh on save
- **💾 Configuration Profiles** — Named profiles; a folder can have multiple rule sets, switch profiles to switch rules
- **📤 Export** — Export to HTML (interactive), Markdown, plain text, or Word (.docx); optional answers, rules summary, titles, and properties
- **🖱️ Three Launch Methods** — Command palette / Ribbon icon / Folder context menu

### 1.2.1

**Fixed**: Resolved community review issues — removed dynamic script creation from dependencies, tightened types and API usage, added release build provenance.

### 1.2.0

**New**: Export — HTML (interactive, with navigation and show/hide answers), Markdown, plain text, and Word (.docx); optional answers, rules summary, note titles, and note properties.

### 1.1.6

**Fixed**: "Save as new profile" no longer overwrites the original profile — edits now only modify the working draft, which is written back to the active profile when you switch; save-as-new leaves the original untouched.

### 1.1.5

**New**: Profiles are now named — a folder can hold multiple rule sets (e.g. "Math - single choice", "Math - mistakes"); switching a profile switches its folder and rules. Edits auto-save to the active profile, with create / rename / delete / save-as-new.

### 1.1.4

**Fixed**: On Android, some notes synced from desktop carried absolute device-prefixed paths, breaking folder filtering and reporting "no matching notes".

### 1.1.3

**New**: Property filtering upgraded to condition groups — all conditions inside a group must match (AND), different groups are alternatives (OR), each with its own pick count; each condition supports equals / contains / not equals.

### 1.1.2

**New**: Internal links in the review view are now clickable and open their target in a split pane.

## Installation

### Community Plugin (Recommended)

Search for "**Random Review**" in the Obsidian Community Plugin marketplace.

### Manual

Download `main.js`, `manifest.json`, `styles.css` from [Releases](https://github.com/ktlamors/obsidian-random-review/releases) and place them in:

```
<vault>/.obsidian/plugins/random-review/
```

### BRAT

Add repository: `ktlamors/obsidian-random-review`

## Usage

### 1. Configuration

Settings → Community Plugins → Random Review → Options:

- **Target Folder**: Select the folder containing notes to review
- **Profiles**: Create, select, rename, or delete profiles; a folder can hold multiple rule sets (e.g. "Math - single choice", "Math - mistakes"), and edits auto-save to the active profile
- **Exclude Folders**: Sub-folders to skip
- **Include/Exclude Tags**: Filter by tags (one per line)
- **Property Filters**: Filter into AND condition groups; groups are alternatives (OR), each with its own pick count; each condition supports equals / contains / not equals
- **Pick Count**: Default number of notes when no property filters are set
- **Answer Default Collapsed**: Initial fold state for callouts

Configuration is organized into **profiles**: a profile bundles a folder plus its rules. Edits auto-save to the active profile, and you can "Save as new profile" to duplicate a rule set.

### 2. Launch

Three ways:

- `Ctrl+P` → Search "启动随机复习"
- Click 🎲 icon in the left ribbon
- Right-click a folder → "从此文件夹随机抽取"

### 3. Navigation

| Action             | Button / Shortcut                            |
| ------------------ | -------------------------------------------- |
| Next               | Click「下一题 →」or press`→` / `Space` |
| Previous           | Click「← 上一题」or press`←`             |
| Show/Hide Answer   | Click toggle button or press`A`            |
| Edit Original Note | Click「编辑原笔记」to open split pane        |
| Export             | Click「导出」, choose a format and scope     |
| Exit               | Click`✕` or press `Esc`                 |

### 4. Note Format

Place answers inside a **folded callout**:

```markdown
Question content…

> [!NOTE]- Answer & Explanation
> The correct answer is C
> Explanation: …
```

Click "Show Answer" during review to expand all callouts.

## Keyboard Shortcuts

| Key                | Action                   |
| ------------------ | ------------------------ |
| `→` / `Space` | Next note                |
| `←`             | Previous note            |
| `A`              | Toggle answer visibility |
| `Esc`            | Exit review              |

## Development

```bash
git clone https://github.com/ktlamors/obsidian-random-review.git
cd obsidian-random-review
npm install
npm run build
```

## License

MIT
