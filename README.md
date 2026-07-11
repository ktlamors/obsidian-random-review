# Random Review — Obsidian Random Note Review Plugin

[![简体中文](https://img.shields.io/badge/简体中文-README_CN-blue)](./README_CN.md)

Randomly select notes from specified folders with tag and property filtering, browse them fullscreen with answer toggle. Ideal for flashcard review, random browsing, and quiz simulation.

## Features

- **🎲 Random Extraction** — Pick notes randomly from a target folder with configurable count
- **🏷️ Tag Filtering** — Include or exclude notes by tags (OR logic)
- **📋 Property Filtering** — Filter by frontmatter properties with per-condition pick counts (OR logic)
- **📂 Folder Exclusion** — Exclude specific sub-folders from extraction
- **🖥️ Fullscreen View** — Immersive review view with keyboard shortcuts
- **👁 Answer Toggle** — Expand/collapse folded callouts (`> [!NOTE]-`) with one click
- **✏️ Edit While Reviewing** — Open notes in a split pane for editing, auto-refresh on save
- **💾 Configuration Profiles** — Auto-save and restore settings per target folder
- **🖱️ Three Launch Methods** — Command palette / Ribbon icon / Folder context menu

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
- **Exclude Folders**: Sub-folders to skip
- **Include/Exclude Tags**: Filter by tags (one per line)
- **Property Filters**: Filter by frontmatter properties, each with independent pick count (OR logic)
- **Pick Count**: Default number of notes when no property filters are set
- **Answer Default Collapsed**: Initial fold state for callouts

Configuration is **auto-saved per folder** — switching target folders preserves settings for each one.

### 2. Launch

Three ways:
- `Ctrl+P` → Search "启动随机复习"
- Click 🎲 icon in the left ribbon
- Right-click a folder → "从此文件夹随机抽取"

### 3. Navigation

| Action | Button / Shortcut |
|--------|-------------------|
| Next | Click「下一题 →」or press `→` / `Space` |
| Previous | Click「← 上一题」or press `←` |
| Show/Hide Answer | Click toggle button or press `A` |
| Edit Original Note | Click「编辑原笔记」to open split pane |
| Exit | Click `✕` or press `Esc` |

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

| Key | Action |
|-----|--------|
| `→` / `Space` | Next note |
| `←` | Previous note |
| `A` | Toggle answer visibility |
| `Esc` | Exit review |

## Development

```bash
git clone https://github.com/ktlamors/obsidian-random-review.git
cd obsidian-random-review
npm install
npm run build
```

## License

MIT
