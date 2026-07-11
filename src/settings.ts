import {
  App,
  PluginSettingTab,
  Setting,
  AbstractInputSuggest,
  TFolder,
  TAbstractFile,
} from "obsidian";
import type RandomReviewPlugin from "./main";

// ──────────────────────────────────────────────
// 文件夹自动补全建议组件
// ──────────────────────────────────────────────
class FolderSuggest extends AbstractInputSuggest<TFolder> {
  private onChoose: (folder: TFolder) => void;
  private input: HTMLInputElement;

  constructor(
    app: App,
    inputEl: HTMLInputElement,
    onChoose: (folder: TFolder) => void
  ) {
    super(app, inputEl);
    this.onChoose = onChoose;
    this.input = inputEl;

    // 聚焦时自动弹出全部文件夹
    inputEl.addEventListener("focus", () => {
      // 短暂清空再恢复，强制触发 suggestion 刷新
      setTimeout(() => {
        const current = this.input.value;
        this.input.value = "";
        this.input.dispatchEvent(new Event("input", { bubbles: true }));
        this.input.value = current;
        this.input.dispatchEvent(new Event("input", { bubbles: true }));
      }, 50);
    });
  }

  getSuggestions(query: string): TFolder[] {
    const folders: TFolder[] = [];
    this.app.vault.getAllLoadedFiles().forEach((file: TAbstractFile) => {
      if (file instanceof TFolder) {
        folders.push(file);
      }
    });

    if (!query) return folders;

    const lower = query.toLowerCase();
    return folders.filter((folder) =>
      folder.path.toLowerCase().includes(lower)
    );
  }

  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    const depth = folder.path.split("/").length - 1;
    const name = folder.path.split("/").pop() || folder.path;
    const parentPath = folder.path.includes("/")
      ? folder.path.substring(0, folder.path.lastIndexOf("/")) + " ▸ "
      : "";

    el.empty();
    el.style.paddingLeft = `${depth * 12 + 4}px`;

    if (parentPath) {
      const parentSpan = el.createSpan({ text: parentPath });
      parentSpan.style.color = "var(--text-muted)";
      parentSpan.style.fontSize = "0.85em";
    }

    const nameSpan = el.createSpan({ text: name });
    nameSpan.style.fontWeight = "600";

    el.createSpan({
      text: "  📁",
      cls: "folder-suggest-icon",
    });
  }

  selectSuggestion(folder: TFolder, _evt: MouseEvent | KeyboardEvent): void {
    this.input.value = folder.path;
    this.onChoose(folder);
    this.close();
  }
}

// ──────────────────────────────────────────────
// 设置面板
// ──────────────────────────────────────────────
export class RandomReviewSettingTab extends PluginSettingTab {
  plugin: RandomReviewPlugin;

  constructor(app: App, plugin: RandomReviewPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // ── 笔记筛选 ──
    containerEl.createEl("h2", { text: "笔记筛选" });

    // 目标文件夹（带自动补全）
    const folderPathSetting = new Setting(containerEl)
      .setName("目标文件夹")
      .setDesc("从中抽取笔记的文件夹路径，点击或输入自动列出全部目录");
    this.addFolderSuggestInput(
      folderPathSetting,
      this.plugin.settings.folderPath,
      async (folder) => {
        this.plugin.settings.folderPath = folder.path;
        await this.plugin.saveSettings();
      }
    );

    // 排除文件夹
    containerEl.createEl("h3", { text: "排除文件夹" });
    containerEl.createEl("p", {
      text: "以下文件夹内的笔记不会被抽取",
      cls: "setting-item-description",
    });

    const excludeContainer = containerEl.createDiv("exclude-folders-list");

    this.plugin.settings.excludeFolders.forEach((folderPath, index) => {
      const itemDiv = excludeContainer.createDiv("exclude-folder-item");
      itemDiv.style.display = "flex";
      itemDiv.style.alignItems = "center";
      itemDiv.style.gap = "8px";
      itemDiv.style.marginBottom = "4px";

      const inputWrapper = itemDiv.createDiv();
      inputWrapper.style.flex = "1";

      const textComponent = new Setting(inputWrapper).addText((text) =>
        text.setValue(folderPath).setPlaceholder("选择要排除的文件夹…")
      );

      const inputEl = (textComponent as any).inputEl as HTMLInputElement;
      new FolderSuggest(this.app, inputEl, async (f) => {
        this.plugin.settings.excludeFolders[index] = f.path;
        await this.plugin.saveSettings();
      });

      // 手动输入也保存
      inputEl.addEventListener("change", async () => {
        this.plugin.settings.excludeFolders[index] = inputEl.value.trim();
        await this.plugin.saveSettings();
      });

      // 移除按钮
      const removeBtn = itemDiv.createEl("button", {
        text: "✕",
        cls: "exclude-folder-remove-btn",
      });
      removeBtn.style.background = "none";
      removeBtn.style.border = "none";
      removeBtn.style.cursor = "pointer";
      removeBtn.style.color = "var(--text-muted)";
      removeBtn.style.fontSize = "1.2em";
      removeBtn.addEventListener("click", async () => {
        this.plugin.settings.excludeFolders.splice(index, 1);
        await this.plugin.saveSettings();
        this.display();
      });
    });

    // 添加排除文件夹按钮
    new Setting(containerEl).addButton((btn) =>
      btn.setButtonText("+ 添加排除文件夹").onClick(async () => {
        this.plugin.settings.excludeFolders.push("");
        await this.plugin.saveSettings();
        this.display();
      })
    );

    // 包含标签
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

    // 排除标签
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

    // ── 属性筛选 ──
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

    // ── 抽取规则 ──
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

    // ── 显示设置 ──
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

  // ──────────────────────────────────────────
  // 辅助方法
  // ──────────────────────────────────────────

  /**
   * 添加带文件夹自动补全的文本输入
   */
  private addFolderSuggestInput(
    setting: Setting,
    initialPath: string,
    onSelect: (folder: TFolder) => void
  ): void {
    setting.addText((text) => {
      text.setValue(initialPath).setPlaceholder("点击选择或输入文件夹路径…");

      const inputEl = (text as any).inputEl as HTMLInputElement;
      new FolderSuggest(this.app, inputEl, onSelect);
    });
  }

  /**
   * 添加一条属性筛选行
   */
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
