# Random Review — Obsidian Random Note Review Plugin

[![中文](https://img.shields.io/badge/中文-README_ZH-blue)](./README_ZH.md)  [![Obsidian](https://img.shields.io/badge/Obsidian-Plugin-purple.svg)](https://obsidian.md)  [![Release](https://img.shields.io/github/v/release/ktlamors/obsidian-random-review)](https://github.com/ktlamors/obsidian-random-review/releases)  [![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Randomly pick notes from a folder with tag and property filtering, review them fullscreen with one-click answer toggle, run quiz mode with a timer, and keep per-extraction answer history with wrong-answer review. Export sessions to HTML, Markdown, plain text, or Word. Ideal for flashcard review, random browsing, wrong-answer retraining, and quiz simulation.

## Community

Feedback and questions are welcome:

- **Telegram**: [t.me/RandomReviewPlugin](https://t.me/RandomReviewPlugin)
- **QQ Group**: `283864869` (search the group number in QQ to join)

## Features

- **🎲 Random Extraction** — Pick notes randomly from a target folder with configurable count
- **🏷️ Tag Filtering** — Include or exclude notes by tags (OR logic)
- **📋 Property Condition Groups** — All conditions inside a group must match (AND); different groups are alternatives (OR), each with its own pick count
- **📂 Folder Exclusion** — Exclude specific sub-folders from extraction
- **👁 Answer Toggle** — Expand/collapse folded callouts (`> [!NOTE]-`) with one click
- **✏️ Edit While Reviewing** — Open notes in a split pane for editing, auto-refresh on save
- **💾 Configuration Profiles** — Named profiles; a folder can have multiple rule sets, switch profiles to switch rules
- **🗂 Extraction History** — Every extraction is saved automatically (profile + date), renamable, deduped when the same notes are picked again, and reloadable with one click from the right "Extraction History" panel
- **📊 Quiz History by Extraction** — Answer records are linked to their extraction and aggregated per extraction in the right "Quiz History" panel, with correct/incorrect/skipped stats
- **❌ Wrong-Answer Review** — Filter "wrong only", then review a single extraction's mistakes or all wrong notes at once; notes you answer correctly are removed from the wrong set automatically
- **📤 Export** — Export to HTML (interactive, with navigation and show/hide answers), Markdown, plain text, or Word (.docx); optional answers, rules summary, titles, and properties
- **🖱️ Three Launch Methods** — Command palette / Ribbon icon (left-click extracts, right-click opens a menu) / Folder context menu

### 1.4.0

**New**: Extraction history — every extraction is saved automatically (named by profile + date, renamable, identical extractions deduped), managed and reloaded from the right "Extraction History" panel, and review sessions are linked to their extraction. Quiz history is now aggregated per extraction in the right "Quiz History" panel with a "wrong only" filter and one-click wrong-answer review — per extraction or across all wrong notes — and notes answered correctly leave the wrong set automatically. The ribbon right-click now opens a menu (Pick profile & extract / Extraction control / Quiz history / Extraction history). Changelog moved to its own settings tab.

### 1.3.0

**New**: Quiz mode — timer tracks elapsed time per question, ✓/✗ buttons mark correct/incorrect (shortcuts J/K), top-bar "History" button opens right sidebar with per-question records, hover a record and click "Review" to open the note in a split pane; settings tab adds quiz mode toggle and timer stop mode; Chinese/English interface language.

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
- **Profiles**: Create, select, rename, or delete profiles; a folder can hold multiple rule sets, edits auto-save to the active profile
- **Exclude Folders**: Sub-folders to skip
- **Include/Exclude Tags**: Filter by tags (one per line)
- **Property Condition Groups**: AND within a group, OR between groups, each with its own pick count; supports equals / contains / not equals
- **Pick Count**: Default number of notes when no property filters are set
- **Answer Default Collapsed**: Initial fold state for callouts
- **Quiz Mode**: Enable timer and correct/incorrect/skip buttons with keyboard shortcuts
- **Timer Stop Mode**: Choose when the timer stops — when answer is shown, when answer is marked, or when navigating away

Configuration is organized into **profiles**: a profile bundles a folder plus its rules. Edits auto-save to the active profile, and you can "Save as new profile" to duplicate a rule set.

### 2. Launch

Three ways:

- `Ctrl+P` → Search "Start Random Review"
- Click 🎲 icon in the left ribbon (left-click extracts; right-click opens a menu with "Pick profile & extract", "Extraction control", "Quiz history", and "Extraction history")
- Right-click a folder → "Random pick from this folder"

### 3. Extraction History & Quiz History

- Every extraction is saved automatically in the **Extraction History** panel (right sidebar): rename, delete, or click "Load" to reopen it in the middle workspace as a new tab. Re-running an identical extraction does not create a duplicate record.
- Answer records from quiz mode are linked to the extraction they came from. Open the **Quiz History** panel (right sidebar or top-bar "History" while reviewing) to see each extraction's aggregate stats.
- Tick **"Wrong only"** to show mistakes only, still grouped per extraction.
- **"Review wrong"** (per extraction) or **"Review all wrong"** (top bar) starts a new review session on just those notes. When you answer a note correctly during wrong-answer review, it is removed from the wrong set for the next time.

### 4. Navigation

| Action | Button / Shortcut |
| --- | --- |
| Next | Click「Next →」or press `→` / `Space` |
| Previous | Click「← Previous」or press `←` |
| Show/Hide Answer | Click toggle button or press `A` |
| Mark Correct | Click ✓ or press `J` |
| Mark Incorrect | Click ✗ or press `K` |
| Skip | Click「Skip」or press `⏭` |
| View Quiz History | Click「History」in top bar; right sidebar shows records grouped by extraction |
| Review Note | In quiz history, click「Review」on a row to open the note in split pane |
| Edit Original Note | Click「Edit Note」to open split pane |
| Export | Click「Export」, choose a format and scope |
| Exit | Click `✕` or press `Esc` |

### 5. Note Format

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
| --- | --- |
| `→` / `Space` | Next note |
| `←` | Previous note |
| `A` | Toggle answer visibility |
| `J` | Mark as correct |
| `K` | Mark as incorrect |
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
