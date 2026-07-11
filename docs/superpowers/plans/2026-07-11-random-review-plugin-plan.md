# Random Review Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Obsidian plugin that randomly selects notes from a configured folder with tag/property filtering, displays them fullscreen with navigation, and supports toggling callout-based answers.

**Architecture:** Custom ItemView plugin with esbuild bundling. Five source modules: constants (view type ID, defaults), settings (data model + settings tab), note-extractor (filter + Fisher-Yates shuffle), review-view (ItemView with MarkdownRenderer + navigation + callout toggle), and main (plugin entry, commands, ribbon, context menu).

**Tech Stack:** TypeScript, Obsidian Plugin API (`obsidian` npm module), esbuild, native CSS

## Global Constraints

- Plugin ID: `random-review`
- Minimum Obsidian version: 1.0.0
- Desktop only: false (works on mobile too)
- All copy text in Chinese (Simplified)
- Output file: `main.js` (bundled by esbuild)

---

## File Structure

```
random-review/
├── manifest.json
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
├── styles.css
├── src/
│   ├── main.ts
│   ├── settings.ts
│   ├── note-extractor.ts
│   ├── review-view.ts
│   └── constants.ts
└── README.md
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `manifest.json`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `esbuild.config.mjs`

**Produces:** Buildable plugin skeleton — `npm install && npm run build` succeeds (with empty src files).

- [ ] **Step 1: Create manifest.json**

```json
{
  "id": "random-review",
  "name": "Random Review",
  "version": "1.0.0",
  "minAppVersion": "1.0.0",
  "description": "从指定文件夹随机抽取笔记，支持标签和属性筛选，全屏浏览复习",
  "author": "Your Name",
  "authorUrl": "",
  "isDesktopOnly": false
}
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "obsidian-random-review",
  "version": "1.0.0",
  "description": "Random note review plugin for Obsidian",
  "main": "main.js",
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "tsc -noEmit -skipLibCheck && node esbuild.config.mjs production"
  },
  "keywords": [],
  "author": "",
  "license": "MIT",
  "devDependencies": {
    "@types/node": "^20.0.0",
    "esbuild": "^0.19.0",
    "obsidian": "latest",
    "typescript": "^5.0.0"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES6",
    "module": "commonjs",
    "lib": ["ES6", "DOM"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": ".",
    "rootDir": "src",
    "moduleResolution": "node",
    "declaration": false,
    "sourceMap": false
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 4: Create esbuild.config.mjs**

```javascript
import esbuild from "esbuild";
import process from "process";

const prod = process.argv[2] === "production";

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron"],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  minify: prod,
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
```

- [ ] **Step 5: Create placeholder src files so build passes**

Create `src/main.ts` with minimal content:
```typescript
import { Plugin } from "obsidian";

export default class RandomReviewPlugin extends Plugin {
  async onload() {
    console.log("Random Review plugin loaded");
  }
}
```

Create empty `src/constants.ts`:
```typescript
// Placeholder
```

Create empty `src/settings.ts`:
```typescript
// Placeholder
```

Create empty `src/note-extractor.ts`:
```typescript
// Placeholder
```

Create empty `src/review-view.ts`:
```typescript
// Placeholder
```

- [ ] **Step 6: Install dependencies and verify build**

```bash
cd "G:/random test" && npm install
```

Expected: dependencies installed, no errors.

```bash
cd "G:/random test" && npm run build
```

Expected: `main.js` produced, no errors.

---

### Task 2: Constants

**Files:**
- Overwrite: `src/constants.ts`

**Produces:** `VIEW_TYPE_RANDOM_REVIEW` constant and `DEFAULT_SETTINGS` object available for other modules.

- [ ] **Step 1: Write constants.ts**

```typescript
export const VIEW_TYPE_RANDOM_REVIEW = "random-review-view";

export const PLUGIN_NAME = "Random Review";

export interface PropertyFilter {
  key: string;
  value: string;
  operator: "equals" | "contains" | "not-equals";
}

export interface RandomReviewSettings {
  folderPath: string;
  excludeFolders: string[];
  includeTags: string[];
  excludeTags: string[];
  propertyFilters: PropertyFilter[];
  pickCount: number;
  randomOrder: boolean;
  answerDefaultCollapsed: boolean;
  showNavigationBar: boolean;
}

export const DEFAULT_SETTINGS: RandomReviewSettings = {
  folderPath: "",
  excludeFolders: [],
  includeTags: [],
  excludeTags: [],
  propertyFilters: [],
  pickCount: 10,
  randomOrder: true,
  answerDefaultCollapsed: true,
  showNavigationBar: true,
};
```

- [ ] **Step 2: Verify build**

```bash
cd "G:/random test" && npm run build
```

Expected: no TypeScript errors, `main.js` produced.

---

### Task 3: Settings Model and Settings Tab

**Files:**
- Overwrite: `src/settings.ts`

**Interfaces:**
- Consumes: `RandomReviewSettings`, `DEFAULT_SETTINGS` from `constants.ts`
- Produces: `RandomReviewSettingTab` class (extends `PluginSettingTab`)

- [ ] **Step 1: Write settings.ts**

```typescript
import { App, PluginSettingTab, Setting } from "obsidian";
import type RandomReviewPlugin from "./main";
import type { RandomReviewSettings } from "./constants";

export class RandomReviewSettingTab extends PluginSettingTab {
  plugin: RandomReviewPlugin;

  constructor(app: App, plugin: RandomReviewPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // --- 笔记筛选 ---
    containerEl.createEl("h2", { text: "笔记筛选" });

    new Setting(containerEl)
      .setName("目标文件夹")
      .setDesc("从中抽取笔记的文件夹路径")
      .addText((text) =>
        text
          .setPlaceholder("flashcards/")
          .setValue(this.plugin.settings.folderPath)
          .onChange(async (value) => {
            this.plugin.settings.folderPath = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("排除文件夹")
      .setDesc("不会被抽取的子文件夹（每行一个）")
      .addTextArea((text) =>
        text
          .setPlaceholder("archive/\ndraft/")
          .setValue(this.plugin.settings.excludeFolders.join("\n"))
          .onChange(async (value) => {
            this.plugin.settings.excludeFolders = value
              .split("\n")
              .map((s) => s.trim())
              .filter((s) => s.length > 0);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("包含标签")
      .setDesc("只抽取包含以下任一标签的笔记（每行一个，# 号可选）")
      .addTextArea((text) =>
        text
          .setPlaceholder("math\nhistory")
          .setValue(this.plugin.settings.includeTags.join("\n"))
          .onChange(async (value) => {
            this.plugin.settings.includeTags = value
              .split("\n")
              .map((s) => s.trim().replace(/^#/, ""))
              .filter((s) => s.length > 0);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("排除标签")
      .setDesc("排除包含以下任一标签的笔记（每行一个）")
      .addTextArea((text) =>
        text
          .setPlaceholder("draft\nprivate")
          .setValue(this.plugin.settings.excludeTags.join("\n"))
          .onChange(async (value) => {
            this.plugin.settings.excludeTags = value
              .split("\n")
              .map((s) => s.trim().replace(/^#/, ""))
              .filter((s) => s.length > 0);
            await this.plugin.saveSettings();
          })
      );

    // 属性筛选
    containerEl.createEl("h3", { text: "属性筛选" });
    containerEl.createEl("p", {
      text: "多个条件同时满足（AND），格式：属性名=值，每行一个",
      cls: "setting-item-description",
    });

    this.plugin.settings.propertyFilters.forEach((filter, index) => {
      this.addPropertyFilterSetting(containerEl, filter, index);
    });

    new Setting(containerEl).addButton((btn) =>
      btn.setButtonText("+ 添加属性筛选").onClick(async () => {
        this.plugin.settings.propertyFilters.push({
          key: "",
          value: "",
          operator: "equals",
        });
        await this.plugin.saveSettings();
        this.display();
      })
    );

    // --- 抽取规则 ---
    containerEl.createEl("h2", { text: "抽取规则" });

    new Setting(containerEl)
      .setName("抽取数量")
      .setDesc("每次随机抽取的笔记数量")
      .addText((text) =>
        text
          .setPlaceholder("10")
          .setValue(String(this.plugin.settings.pickCount))
          .onChange(async (value) => {
            const num = parseInt(value);
            if (!isNaN(num) && num > 0) {
              this.plugin.settings.pickCount = num;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("随机排列")
      .setDesc("开启后随机打乱笔记顺序；关闭则按文件名字母排序")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.randomOrder)
          .onChange(async (value) => {
            this.plugin.settings.randomOrder = value;
            await this.plugin.saveSettings();
          })
      );

    // --- 显示设置 ---
    containerEl.createEl("h2", { text: "显示设置" });

    new Setting(containerEl)
      .setName("答案默认折叠")
      .setDesc("开启后，每篇笔记的答案（折叠 callout）初始为折叠状态")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.answerDefaultCollapsed)
          .onChange(async (value) => {
            this.plugin.settings.answerDefaultCollapsed = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("显示导航栏")
      .setDesc("显示底部导航栏（上一题/下一题/答案切换）")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showNavigationBar)
          .onChange(async (value) => {
            this.plugin.settings.showNavigationBar = value;
            await this.plugin.saveSettings();
          })
      );
  }

  private addPropertyFilterSetting(
    containerEl: HTMLElement,
    filter: { key: string; value: string; operator: string },
    index: number
  ): void {
    const setting = new Setting(containerEl);
    setting.addText((text) =>
      text
        .setPlaceholder("属性名")
        .setValue(filter.key)
        .onChange(async (value) => {
          this.plugin.settings.propertyFilters[index].key = value;
          await this.plugin.saveSettings();
        })
    );
    setting.addText((text) =>
      text
        .setPlaceholder("属性值")
        .setValue(filter.value)
        .onChange(async (value) => {
          this.plugin.settings.propertyFilters[index].value = value;
          await this.plugin.saveSettings();
        })
    );
    setting.addExtraButton((btn) =>
      btn
        .setIcon("cross")
        .setTooltip("移除")
        .onClick(async () => {
          this.plugin.settings.propertyFilters.splice(index, 1);
          await this.plugin.saveSettings();
          this.display();
        })
    );
  }
}
```

- [ ] **Step 2: Verify build**

```bash
cd "G:/random test" && npm run build
```

Expected: compiler errors about missing imports from `main.ts` are acceptable at this stage (main.ts hasn't been updated yet). If there are errors in `settings.ts` itself, fix them.

---

### Task 4: Note Extractor

**Files:**
- Create: `src/note-extractor.ts`

**Interfaces:**
- Consumes: `RandomReviewSettings` from `constants.ts`
- Produces: `extractNotes(app: App, settings: RandomReviewSettings): TFile[]`

- [ ] **Step 1: Write note-extractor.ts**

```typescript
import { App, Notice, TFile } from "obsidian";
import type { RandomReviewSettings } from "./constants";

/**
 * 根据设置从 valut 中筛选并随机抽取笔记。
 * 返回符合条件的 TFile 数组。
 */
export function extractNotes(
  app: App,
  settings: RandomReviewSettings
): TFile[] {
  // 1. 获取所有 markdown 文件
  let files = app.vault.getMarkdownFiles();

  // 2. 按文件夹筛选
  if (settings.folderPath) {
    const normalizedPath = settings.folderPath.replace(/^\/+|\/+$/g, "");
    files = files.filter((file) => file.path.startsWith(normalizedPath + "/") || file.path.startsWith(normalizedPath));
    // Also include files directly in the folder (path === folderPath not possible for files)
    files = files.filter((file) => {
      const dir = file.path.substring(0, file.path.lastIndexOf("/"));
      return dir === normalizedPath || file.path.startsWith(normalizedPath + "/");
    });
  }

  // 3. 排除子文件夹
  if (settings.excludeFolders.length > 0) {
    files = files.filter((file) => {
      return !settings.excludeFolders.some((exclude) => {
        const normalized = exclude.replace(/^\/+|\/+$/g, "");
        return file.path.startsWith(normalized + "/");
      });
    });
  }

  // 4. 按标签筛选
  if (settings.includeTags.length > 0 || settings.excludeTags.length > 0) {
    files = files.filter((file) => {
      const cache = app.metadataCache.getFileCache(file);
      if (!cache) return settings.includeTags.length === 0;

      // 收集文件中的所有标签
      const fileTags: string[] = [];

      // 从内容标签获取
      if (cache.tags) {
        cache.tags.forEach((t) => {
          const tagName = t.tag.replace(/^#/, "");
          fileTags.push(tagName);
        });
      }

      // 从 frontmatter tags 获取
      const frontmatterTags = cache.frontmatter?.tags;
      if (frontmatterTags) {
        if (Array.isArray(frontmatterTags)) {
          frontmatterTags.forEach((t: string) =>
            fileTags.push(String(t).replace(/^#/, ""))
          );
        } else if (typeof frontmatterTags === "string") {
          fileTags.push(frontmatterTags.replace(/^#/, ""));
        }
      }

      // includeTags: OR 逻辑 — 至少匹配一个
      if (settings.includeTags.length > 0) {
        const hasIncludeTag = settings.includeTags.some((tag) =>
          fileTags.includes(tag)
        );
        if (!hasIncludeTag) return false;
      }

      // excludeTags: 如果有排除标签则过滤
      if (settings.excludeTags.length > 0) {
        const hasExcludeTag = settings.excludeTags.some((tag) =>
          fileTags.includes(tag)
        );
        if (hasExcludeTag) return false;
      }

      return true;
    });
  }

  // 5. 按属性筛选 (AND 逻辑)
  if (settings.propertyFilters.length > 0) {
    files = files.filter((file) => {
      const cache = app.metadataCache.getFileCache(file);
      if (!cache) return false;

      const frontmatter = cache.frontmatter;
      if (!frontmatter) return false;

      return settings.propertyFilters.every((filter) => {
        if (filter.key === "" || filter.value === "") return true; // 空条件跳过

        const actualValue = frontmatter[filter.key];
        if (actualValue === undefined || actualValue === null) return false;

        const actualStr = String(actualValue);

        switch (filter.operator) {
          case "equals":
            return actualStr === filter.value;
          case "contains":
            return actualStr.includes(filter.value);
          case "not-equals":
            return actualStr !== filter.value;
          default:
            return true;
        }
      });
    });
  }

  // 6. 检查是否有候选笔记
  if (files.length === 0) {
    new Notice("没有符合条件的笔记，请检查设置");
    return [];
  }

  // 7. 随机排列或按文件名排序
  if (settings.randomOrder) {
    files = fisherYatesShuffle([...files]);
  } else {
    files = [...files].sort((a, b) => a.basename.localeCompare(b.basename));
  }

  // 8. 取前 pickCount 篇
  if (files.length < settings.pickCount) {
    new Notice(`只有 ${files.length} 篇符合条件的笔记`);
  }

  return files.slice(0, settings.pickCount);
}

/**
 * Fisher-Yates 洗牌算法
 */
function fisherYatesShuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
```

- [ ] **Step 2: Verify build**

```bash
cd "G:/random test" && npm run build
```

Expected: no TypeScript errors in note-extractor.ts (main.ts errors are ok).

---

### Task 5: Review View

**Files:**
- Overwrite: `src/review-view.ts`

**Interfaces:**
- Consumes: `VIEW_TYPE_RANDOM_REVIEW` from `constants.ts`, `App`, `TFile`
- Produces: `ReviewView` class (extends `ItemView`)

- [ ] **Step 1: Write review-view.ts**

```typescript
import { ItemView, WorkspaceLeaf, TFile, MarkdownRenderer, Notice } from "obsidian";
import { VIEW_TYPE_RANDOM_REVIEW } from "./constants";

export class ReviewView extends ItemView {
  private queue: TFile[] = [];
  private currentIndex: number = 0;
  private answerVisible: boolean = false;

  private topBarEl!: HTMLElement;
  private contentEl!: HTMLElement;
  private navBarEl!: HTMLElement;
  private titleEl!: HTMLElement;
  private positionEl!: HTMLElement;
  private prevBtn!: HTMLButtonElement;
  private nextBtn!: HTMLButtonElement;
  private toggleAnswerBtn!: HTMLButtonElement;
  private exitBtn!: HTMLButtonElement;

  private answerDefaultCollapsed: boolean = true;
  private showNavBar: boolean = true;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_RANDOM_REVIEW;
  }

  getDisplayText(): string {
    return "Random Review";
  }

  getIcon(): string {
    return "dice";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("random-review-container");

    // 顶部栏
    this.topBarEl = container.createDiv("random-review-topbar");
    this.titleEl = this.topBarEl.createSpan("random-review-title");
    this.exitBtn = this.topBarEl.createEl("button", {
      text: "✕",
      cls: "random-review-exit-btn",
    });
    this.exitBtn.addEventListener("click", () => this.closeView());

    // 内容区
    this.contentEl = container.createDiv("random-review-content");

    // 底部导航栏
    this.navBarEl = container.createDiv("random-review-navbar");

    this.prevBtn = this.navBarEl.createEl("button", {
      text: "← 上一题",
      cls: "random-review-nav-btn",
    });
    this.prevBtn.addEventListener("click", () => this.navigate(-1));

    this.positionEl = this.navBarEl.createSpan("random-review-position");

    this.nextBtn = this.navBarEl.createEl("button", {
      text: "下一题 →",
      cls: "random-review-nav-btn",
    });
    this.nextBtn.addEventListener("click", () => this.navigate(1));

    this.toggleAnswerBtn = this.navBarEl.createEl("button", {
      text: "显示答案",
      cls: "random-review-toggle-btn",
    });
    this.toggleAnswerBtn.addEventListener("click", () => this.toggleAnswer());

    // 键盘事件
    this.containerEl.addEventListener("keydown", this.handleKeydown.bind(this));
  }

  async onClose(): Promise<void> {
    this.containerEl.removeEventListener("keydown", this.handleKeydown.bind(this));
  }

  /**
   * 由外部调用，设置笔记队列并开始复习
   */
  async startReview(
    queue: TFile[],
    answerDefaultCollapsed: boolean,
    showNavBar: boolean
  ): Promise<void> {
    this.queue = queue;
    this.currentIndex = 0;
    this.answerDefaultCollapsed = answerDefaultCollapsed;
    this.showNavBar = showNavBar;

    // 设置答案初始状态
    this.answerVisible = !answerDefaultCollapsed;

    // 更新导航栏显示
    this.navBarEl.style.display = showNavBar ? "flex" : "none";

    if (queue.length === 0) {
      this.renderEmptyState();
      return;
    }

    await this.renderNote(0);
  }

  /**
   * 渲染空状态
   */
  private renderEmptyState(): void {
    this.topBarEl.style.display = "none";
    this.contentEl.empty();
    this.contentEl.createDiv("random-review-empty");
    const emptyDiv = this.contentEl.querySelector(".random-review-empty");
    if (emptyDiv) {
      emptyDiv.createEl("p", { text: "没有符合条件的笔记 😕" });
      emptyDiv.createEl("p", { text: "请在设置中调整筛选条件后重新启动" });
    }
    this.prevBtn.disabled = true;
    this.nextBtn.disabled = true;
    this.toggleAnswerBtn.style.display = "none";
  }

  /**
   * 渲染指定位置的笔记
   */
  private async renderNote(index: number): Promise<void> {
    if (index < 0 || index >= this.queue.length) return;

    this.currentIndex = index;
    const file = this.queue[index];

    // 检查文件是否仍然存在
    const exists = await this.app.vault.adapter.exists(file.path);
    if (!exists) {
      new Notice(`笔记 "${file.basename}" 已被删除，自动跳过`);
      this.queue.splice(index, 1);
      if (this.queue.length === 0) {
        this.renderEmptyState();
        return;
      }
      // 跳到下一篇（或上一篇如果在末尾）
      const newIndex = Math.min(index, this.queue.length - 1);
      await this.renderNote(newIndex);
      return;
    }

    // 读取并渲染笔记内容
    try {
      const content = await this.app.vault.read(file);
      this.titleEl.setText(file.basename);
      this.topBarEl.style.display = "flex";

      // 清空并渲染 Markdown
      this.contentEl.empty();
      const markdownContainer = this.contentEl.createDiv("markdown-preview-view");
      await MarkdownRenderer.render(
        this.app,
        content,
        markdownContainer,
        file.path,
        this
      );

      // 应用答案可见性状态
      this.applyAnswerState();

      // 更新位置指示器和按钮状态
      this.updateUIState();
    } catch (err) {
      this.contentEl.empty();
      this.contentEl.createDiv("random-review-error");
      const errDiv = this.contentEl.querySelector(".random-review-error");
      if (errDiv) {
        errDiv.createEl("p", { text: `无法读取笔记: ${file.basename}` });
        errDiv.createEl("p", { text: String(err) });
      }
      this.updateUIState();
    }
  }

  /**
   * 应用答案折叠/展开状态到 DOM
   */
  private applyAnswerState(): void {
    const callouts = this.contentEl.querySelectorAll(
      ".callout.is-collapsible"
    );
    callouts.forEach((el) => {
      if (this.answerVisible) {
        el.classList.remove("is-collapsed");
      } else {
        el.classList.add("is-collapsed");
      }
    });
  }

  /**
   * 更新导航栏按钮状态
   */
  private updateUIState(): void {
    this.prevBtn.disabled = this.currentIndex <= 0;
    this.nextBtn.disabled = this.currentIndex >= this.queue.length - 1;
    this.positionEl.setText(
      `${this.currentIndex + 1} / ${this.queue.length}`
    );
    this.toggleAnswerBtn.setText(
      this.answerVisible ? "隐藏答案" : "显示答案"
    );

    // 只有一篇笔记时隐藏导航按钮
    const singleNote = this.queue.length <= 1;
    this.navBarEl.style.display = singleNote ? "none" : (this.showNavBar ? "flex" : "none");
  }

  /**
   * 上一题 / 下一题
   */
  private async navigate(delta: number): Promise<void> {
    const newIndex = this.currentIndex + delta;

    if (newIndex < 0) {
      return; // 已在第一篇，不能往前
    }

    if (newIndex >= this.queue.length) {
      // 已到最后一篇，询问是否重新抽取
      new Notice("已完成本轮复习！可在设置中调整后重新启动");
      return;
    }

    await this.renderNote(newIndex);
  }

  /**
   * 切换显示/隐藏答案
   */
  private toggleAnswer(): void {
    this.answerVisible = !this.answerVisible;
    this.applyAnswerState();
    this.updateUIState();
  }

  /**
   * 键盘快捷键处理
   */
  private handleKeydown(event: KeyboardEvent): void {
    // 如果焦点在输入框中，不处理
    const target = event.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

    switch (event.key) {
      case "ArrowRight":
      case " ":
        event.preventDefault();
        this.navigate(1);
        break;
      case "ArrowLeft":
        event.preventDefault();
        this.navigate(-1);
        break;
      case "a":
      case "A":
        event.preventDefault();
        this.toggleAnswer();
        break;
      case "Escape":
        event.preventDefault();
        this.closeView();
        break;
    }
  }

  /**
   * 关闭视图
   */
  private closeView(): void {
    this.leaf.detach();
  }
}
```

- [ ] **Step 2: Verify build**

```bash
cd "G:/random test" && npm run build
```

Expected: no TypeScript errors in review-view.ts (main.ts errors are ok).

---

### Task 6: Main Plugin Entry

**Files:**
- Overwrite: `src/main.ts`

**Interfaces:**
- Consumes: All other modules — `VIEW_TYPE_RANDOM_REVIEW`, `PLUGIN_NAME`, `RandomReviewSettings`, `DEFAULT_SETTINGS` from `constants.ts`; `RandomReviewSettingTab` from `settings.ts`; `extractNotes` from `note-extractor.ts`; `ReviewView` from `review-view.ts`
- Produces: `RandomReviewPlugin` (default export, extends `Plugin`)

- [ ] **Step 1: Write main.ts**

```typescript
import {
  App,
  Plugin,
  PluginSettingTab,
  WorkspaceLeaf,
  Notice,
  TFile,
  MarkdownView,
} from "obsidian";
import {
  VIEW_TYPE_RANDOM_REVIEW,
  PLUGIN_NAME,
  RandomReviewSettings,
  DEFAULT_SETTINGS,
} from "./constants";
import { RandomReviewSettingTab } from "./settings";
import { extractNotes } from "./note-extractor";
import { ReviewView } from "./review-view";

export default class RandomReviewPlugin extends Plugin {
  settings: RandomReviewSettings;

  async onload(): Promise<void> {
    await this.loadSettings();

    // 注册设置 Tab
    this.addSettingTab(new RandomReviewSettingTab(this.app, this));

    // 注册视图
    this.registerView(
      VIEW_TYPE_RANDOM_REVIEW,
      (leaf: WorkspaceLeaf) => new ReviewView(leaf)
    );

    // 注册命令：启动随机复习
    this.addCommand({
      id: "start-random-review",
      name: "启动随机复习",
      callback: () => this.startReview(),
    });

    // 注册 Ribbon 图标
    this.addRibbonIcon("dice", "随机复习", () => this.startReview());

    // 注册文件夹右键菜单
    this.registerEvent(
      this.app.workspace.on(
        "file-menu" as any,
        (menu: any, file: TFile, source: string) => {
          // folder context menu
          if (file && (file as any).children !== undefined) {
            menu.addItem((item: any) => {
              item
                .setTitle("从此文件夹随机抽取")
                .setIcon("dice")
                .onClick(async () => {
                  // 临时覆盖文件夹路径
                  this.settings.folderPath = file.path;
                  await this.saveSettings();
                  this.startReview();
                });
            });
          }
        }
      )
    );

    console.log(`${PLUGIN_NAME} plugin loaded`);
  }

  onunload(): void {
    console.log(`${PLUGIN_NAME} plugin unloaded`);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData()
    );
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /**
   * 启动随机复习：抽取笔记 + 打开复习视图
   */
  async startReview(): Promise<void> {
    // 验证设置
    if (!this.settings.folderPath) {
      new Notice("请先在设置中指定目标文件夹");
      return;
    }

    // 抽取笔记
    const queue = extractNotes(this.app, this.settings);

    if (queue.length === 0) {
      return; // extractNotes 内部已显示 Notice
    }

    // 获取或创建视图叶子
    const { workspace } = this.app;

    // 检查是否已有 review view 打开
    let leaf: WorkspaceLeaf | null = null;
    const existing = workspace.getLeavesOfType(VIEW_TYPE_RANDOM_REVIEW);
    if (existing.length > 0) {
      leaf = existing[0];
    } else {
      // 在主区域创建新叶子
      leaf = workspace.getLeaf("tab");
    }

    // 设置视图
    await leaf.setViewState({
      type: VIEW_TYPE_RANDOM_REVIEW,
      active: true,
    });

    // 聚焦视图
    workspace.revealLeaf(leaf);

    // 启动复习
    const view = leaf.view as ReviewView;
    await view.startReview(
      queue,
      this.settings.answerDefaultCollapsed,
      this.settings.showNavigationBar
    );
  }
}
```

- [ ] **Step 2: Verify build**

```bash
cd "G:/random test" && npm run build
```

Expected: clean build, no errors.

---

### Task 7: Styles

**Files:**
- Create: `styles.css`

- [ ] **Step 1: Write styles.css**

```css
/* Random Review Plugin Styles */

.random-review-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--background-primary);
}

/* 顶部栏 */
.random-review-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--background-modifier-border);
  flex-shrink: 0;
}

.random-review-title {
  font-size: 1.1em;
  font-weight: 600;
  color: var(--text-normal);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.random-review-exit-btn {
  background: none;
  border: none;
  font-size: 1.3em;
  cursor: pointer;
  color: var(--text-muted);
  padding: 4px 8px;
  border-radius: 4px;
  line-height: 1;
}

.random-review-exit-btn:hover {
  background: var(--background-modifier-hover);
  color: var(--text-normal);
}

/* 内容区 */
.random-review-content {
  flex: 1;
  overflow-y: auto;
  padding: 30px 40px;
  max-width: 800px;
  width: 100%;
  margin: 0 auto;
}

.random-review-content .markdown-preview-view {
  font-size: 1em;
  line-height: 1.8;
}

/* 空状态和错误状态 */
.random-review-empty,
.random-review-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
  gap: 8px;
}

.random-review-empty p,
.random-review-error p {
  margin: 4px 0;
  font-size: 1.1em;
}

.random-review-error {
  color: var(--text-error);
}

/* 底部导航栏 */
.random-review-navbar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 14px 20px;
  border-top: 1px solid var(--background-modifier-border);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.random-review-position {
  font-size: 0.95em;
  color: var(--text-muted);
  min-width: 60px;
  text-align: center;
  user-select: none;
}

.random-review-nav-btn {
  padding: 8px 20px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  background: var(--background-secondary);
  color: var(--text-normal);
  cursor: pointer;
  font-size: 0.95em;
  transition: background 0.15s;
}

.random-review-nav-btn:hover:not(:disabled) {
  background: var(--background-modifier-hover);
}

.random-review-nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.random-review-toggle-btn {
  padding: 8px 20px;
  border: 1px solid var(--interactive-accent);
  border-radius: 6px;
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  cursor: pointer;
  font-size: 0.95em;
  transition: background 0.15s;
}

.random-review-toggle-btn:hover {
  background: var(--interactive-accent-hover);
}

/* 响应式：小屏幕适配 */
@media (max-width: 600px) {
  .random-review-content {
    padding: 16px 20px;
  }

  .random-review-navbar {
    gap: 8px;
    padding: 10px;
  }

  .random-review-nav-btn,
  .random-review-toggle-btn {
    padding: 6px 14px;
    font-size: 0.85em;
  }
}
```

- [ ] **Step 2: Verify final build**

```bash
cd "G:/random test" && npm run build
```

Expected: clean build, `main.js` and `styles.css` ready for deployment.

---

### Task 8: Final Integration Verification

**Files:**
- None (verification only)

- [ ] **Step 1: Verify output files exist**

```bash
cd "G:/random test" && ls -la main.js manifest.json styles.css
```

Expected: all three files present.

- [ ] **Step 2: Verify TypeScript compilation (strict mode)**

```bash
cd "G:/random test" && npx tsc --noEmit -skipLibCheck
```

Expected: no errors.

- [ ] **Step 3: Check manifest.json matches main.js**

```bash
cd "G:/random test" && cat manifest.json
```

Expected: manifest.json has correct id, name, version fields.

- [ ] **Step 4: Manual checklist**

Verify these behaviors in the code:
- [ ] `extractNotes` handles empty folder path gracefully
- [ ] `extractNotes` handles missing frontmatter (returns no match, not crash)
- [ ] `ReviewView.navigate` handles boundary (first/last) correctly
- [ ] `ReviewView.renderNote` handles deleted files by skipping
- [ ] `ReviewView.handleKeydown` ignores input/textarea focus
- [ ] Settings save/load uses Obsidian's `loadData`/`saveData`
- [ ] Right-click menu only activates on folders (checks `.children`)

---

## Dependency Order

```
Task 1 (Scaffolding) → Task 2 (Constants) → Task 3 (Settings)
                                           → Task 4 (Note Extractor)
                                           → Task 5 (Review View) → Task 6 (Main Entry)
                                           → Task 7 (Styles)
All → Task 8 (Integration Verification)
```

Tasks 3, 4, 5 can run in parallel after Task 2. Task 6 depends on 3+4+5. Task 7 is independent but depends on Task 5 (to know CSS class names). Task 8 runs last.
