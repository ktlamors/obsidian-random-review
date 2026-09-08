import {
  App,
  PluginSettingTab,
  Setting,
  TFolder,
  TAbstractFile,
  Notice,
  WorkspaceLeaf,
} from "obsidian";
import type RandomReviewPlugin from "./main";
import {
  PropertyGroup,
  PropertyCondition,
  PropertyOperator,
} from "./constants";
import { getLang, Language } from "./i18n";
import { QuizStorage } from "./quiz-storage";
import { VIEW_TYPE_QUIZ_HISTORY } from "./quiz-history-view";
import { HistoryStorage, HistoryEntry } from "./history-storage";

// ──────────────────────────────────────────────
// 工具函数
// ──────────────────────────────────────────────

function getSubFolders(app: App, parentPath: string, includeSelf: boolean): TFolder[] {
  const folders: TFolder[] = [];
  app.vault.getAllLoadedFiles().forEach((file: TAbstractFile) => {
    if (!(file instanceof TFolder)) return;
    if (file.path === "/") return;
    if (!parentPath) {
      folders.push(file);
    } else {
      const normalized = parentPath.replace(/\/+$/, "");
      if (file.path.startsWith(normalized + "/")) {
        folders.push(file);
      } else if (includeSelf && file.path === normalized) {
        folders.push(file);
      }
    }
  });
  return folders.sort((a, b) => a.path.localeCompare(b.path));
}

function folderDepth(folderPath: string, basePath: string): number {
  if (!basePath) return folderPath.split("/").length - 1;
  const normalized = basePath.replace(/\/+$/, "");
  const relative = folderPath.replace(normalized, "").replace(/^\//, "");
  if (!relative) return 0;
  return relative.split("/").length - 1;
}

function createFolderSelect(
  app: App,
  containerEl: HTMLElement,
  selectedPath: string,
  parentPath: string,
  includeParent: boolean,
  onChange: (path: string) => void
): HTMLSelectElement {
  const select = containerEl.createEl("select");
  select.addClass("dropdown");
  const folders = getSubFolders(app, parentPath, includeParent);
  const emptyOpt = select.createEl("option");
  emptyOpt.value = "";
  emptyOpt.text = "— 未选择 —";
  folders.forEach((folder) => {
    const opt = select.createEl("option");
    opt.value = folder.path;
    const depth = folderDepth(folder.path, parentPath);
    const name = folder.path.split("/").pop() || folder.path;
    const indent = depth > 0 ? "└ ".repeat(depth) : "";
    opt.text = indent + name;
    if (folder.path === selectedPath) opt.selected = true;
  });
  select.addEventListener("change", () => onChange(select.value));
  return select;
}

// ──────────────────────────────────────────────
// 设置面板
// ──────────────────────────────────────────────
export class RandomReviewSettingTab extends PluginSettingTab {
  plugin: RandomReviewPlugin;
  private activeTab:
    | "general"
    | "extraction"
    | "quiz"
    | "history"
    | "changelog" = "extraction";

  constructor(app: App, plugin: RandomReviewPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const t = getLang(this.plugin.settings.language);

    // ── 选项卡栏（放不下时可换行成两行） ──
    const tabBar = containerEl.createDiv("random-review-tabs");
    const makeTab = (
      key: "general" | "extraction" | "quiz" | "history" | "changelog",
      label: string
    ): void => {
      const btn = tabBar.createEl("button", {
        text: label,
        cls: "random-review-tab",
      });
      if (this.activeTab === key) btn.addClass("random-review-tab-active");
      btn.addEventListener("click", () => {
        this.activeTab = key;
        this.display();
      });
    };
    makeTab("general", t.tabGeneral);
    makeTab("extraction", t.tabExtraction);
    makeTab("quiz", t.tabQuiz);
    makeTab("history", t.tabHistory);
    makeTab("changelog", t.tabChangelog);

    const contentEl = containerEl.createDiv("random-review-tab-content");

    if (this.activeTab === "general") {
      this.displayGeneral(contentEl, t);
    } else if (this.activeTab === "quiz") {
      this.displayQuiz(contentEl, t);
    } else if (this.activeTab === "history") {
      this.displayHistory(contentEl, t);
    } else if (this.activeTab === "changelog") {
      this.displayChangelog(contentEl, t);
    } else {
      this.displayExtraction(contentEl, t);
    }
  }

  // ──────────────────────────────────────────
  // 测试模式选项卡
  // ──────────────────────────────────────────

  private async displayQuiz(containerEl: HTMLElement, t: ReturnType<typeof getLang>): Promise<void> {
    const storage = new QuizStorage(this.plugin);

    new Setting(containerEl)
      .setName(t.quizEnabled)
      .setDesc(t.quizEnabledDesc)
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.quizEnabled).onChange(async (v) => {
          this.plugin.settings.quizEnabled = v;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName(t.quizTimerStopMode)
      .setDesc(t.quizTimerStopModeDesc)
      .addDropdown((dd) => {
        dd.addOption("answer", t.quizStopAnswer);
        dd.addOption("mark", t.quizStopMark);
        dd.addOption("navigate", t.quizStopNavigate);
        dd.setValue(this.plugin.settings.quizTimerStopMode).onChange(async (v) => {
          this.plugin.settings.quizTimerStopMode = v as "answer" | "mark" | "navigate";
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl).setName(t.quizStatsTitle).setHeading();
    const stats = await storage.getStats();
    if (stats.total === 0) {
      containerEl.createEl("p", {
        text: t.quizStatsNoHistory,
        cls: "setting-item-description",
      });
    } else {
      const accuracy = stats.total > 0
        ? Math.round((stats.correct / (stats.correct + stats.incorrect)) * 100)
        : 0;
      const table = containerEl.createDiv("quiz-stats-grid");
      const row = (label: string, value: string): void => {
        const r = table.createDiv("quiz-stat-row");
        r.createSpan("quiz-stat-label").setText(label);
        r.createSpan("quiz-stat-value").setText(value);
      };
      row(t.quizStatsTotal, String(stats.total));
      row(t.quizCorrect, String(stats.correct));
      row(t.quizIncorrect, String(stats.incorrect));
      row(t.quizSkipped, String(stats.skipped));
      row(t.quizStatsAccuracy, `${accuracy}%`);
      row(
        t.quizStatsAvgTime,
        stats.avgTime > 0 ? `${Math.round(stats.avgTime / 1000)}s` : "—"
      );
    }

    new Setting(containerEl)
      .addButton((btn) =>
        btn.setButtonText(t.quizViewHistory).onClick(() => {
          const { workspace } = this.app;
          const existing = workspace.getLeavesOfType(VIEW_TYPE_QUIZ_HISTORY);
          let leaf: WorkspaceLeaf;
          if (existing.length > 0) {
            leaf = existing[0];
          } else {
            leaf = workspace.getRightLeaf(false)!;
            void leaf.setViewState({ type: VIEW_TYPE_QUIZ_HISTORY, active: true });
          }
          void workspace.revealLeaf(leaf);
        })
      )
      .addButton((btn) =>
        btn.setButtonText(t.quizClearHistory).setDestructive().onClick(async () => {
          await storage.clear();
          this.display();
          new Notice(t.quizHistoryCleared);
        })
      );
  }

  // ──────────────────────────────────────────
  // 抽取历史选项卡
  // ──────────────────────────────────────────

  private async displayHistory(containerEl: HTMLElement, t: ReturnType<typeof getLang>): Promise<void> {
    const storage = new HistoryStorage(this.plugin);
    const entries = await storage.load();

    if (entries.length === 0) {
      containerEl.createEl("p", {
        text: t.historyEmpty,
        cls: "setting-item-description",
      });
      return;
    }

    const list = containerEl.createDiv("quiz-history-list");
    entries.forEach((entry) => {
      const item = list.createDiv("quiz-history-item");

      const nameSpan = item.createSpan("quiz-history-file");
      nameSpan.setText(entry.name);
      item.createSpan("quiz-history-time").setText(
        `${entry.noteCount} ${t.historyCount.toLowerCase()}`
      );

      item.createEl("button", {
        text: t.historyLoad,
        cls: "quiz-history-review-btn",
      }).addEventListener("click", () => {
        void this.loadHistoryFiles(entry);
      });

      item.createEl("button", {
        text: t.historyRename,
        cls: "quiz-history-review-btn",
      }).addEventListener("click", () => {
        this.startRenameHistory(nameSpan, entry, storage);
      });

      item.createEl("button", {
        text: t.historyDelete,
        cls: "quiz-history-review-btn",
      }).addEventListener("click", () => {
        void this.deleteHistoryEntry(entry.id, storage, t);
      });
    });
  }

  /** 切换到指定选项卡（供外部在打开设置前定位） */
  activateTab(key: "general" | "extraction" | "quiz" | "history"): void {
    this.activeTab = key;
  }

  /** 复制 QQ 群号（带剪贴板降级方案） */
  private async copyQqNumber(): Promise<void> {
    const t = getLang(this.plugin.settings.language);
    const text = "283864869";
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.body.createEl("textarea");
      ta.value = text;
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    new Notice(t.qqCopyNotice);
  }

  /** 当设置面板正停留在历史选项卡时，重绘以反映最新数据 */
  refreshHistoryView(): void {
    if (this.activeTab === "history") this.display();
  }

  private async loadHistoryFiles(entry: HistoryEntry): Promise<void> {
    await this.plugin.loadHistoryEntry(entry);
  }

  private startRenameHistory(nameSpan: HTMLElement, entry: HistoryEntry, storage: HistoryStorage): void {
    nameSpan.empty();
    const input = nameSpan.createEl("input", {
      cls: "quiz-history-rename-input",
      type: "text",
    });
    input.value = entry.name;
    input.select();

    let saved = false;
    const save = async (): Promise<void> => {
      if (saved) return;
      saved = true;
      const val = input.value.trim();
      if (val && val !== entry.name) {
        await storage.rename(entry.id, val);
        new Notice(getLang(this.plugin.settings.language).historyRenamed);
      }
      this.plugin.notifyHistoryChanged();
    };

    input.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void save();
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.plugin.notifyHistoryChanged();
      }
    });
    input.addEventListener("blur", () => {
      void save();
    });
    input.focus();
  }

  private async deleteHistoryEntry(id: string, storage: HistoryStorage, t: ReturnType<typeof getLang>): Promise<void> {
    if (!confirm(t.historyDeleteConfirm)) return;
    await storage.remove(id);
    this.plugin.notifyHistoryChanged();
    new Notice(t.historyDeleted);
  }

  // ──────────────────────────────────────────
  // 通用选项卡
  // ──────────────────────────────────────────
  private displayGeneral(containerEl: HTMLElement, t: ReturnType<typeof getLang>): void {
    // 交流群入口
    new Setting(containerEl)
      .setName(t.communityJoin)
      .setDesc("Telegram · QQ")
      .addButton((btn) =>
        btn
          .setButtonText(t.telegramGroup)
          .setTooltip("https://t.me/RandomReviewPlugin")
          .onClick(() => {
            window.open("https://t.me/RandomReviewPlugin", "_blank");
          })
      )
      .addButton((btn) =>
        btn
          .setButtonText(t.qqGroup)
          .setTooltip("283864869")
          .onClick(() => {
            void this.copyQqNumber();
          })
      );

    new Setting(containerEl)
      .setName(t.languageSetting)
      .setDesc(t.languageDesc)
      .addDropdown((dropdown) => {
        dropdown.addOption("zh", "简体中文");
        dropdown.addOption("en", "English");
        dropdown.setValue(this.plugin.settings.language);
        dropdown.onChange(async (value) => {
          this.plugin.settings.language = value as Language;
          await this.plugin.saveSettings();
          this.plugin.refreshUIStrings();
          this.display();
        });
      });

    new Setting(containerEl).setName(t.pluginIntroTitle).setHeading();
    containerEl.createEl("p", { text: t.pluginIntro, cls: "random-review-intro" });

    new Setting(containerEl).setName(t.usageTitle).setHeading();
    const usageList = containerEl.createEl("ul", { cls: "random-review-usage" });
    t.usageItems.forEach((item) => {
      usageList.createEl("li", { text: item });
    });
  }

  // ──────────────────────────────────────────
  // 更新日志选项卡
  // ──────────────────────────────────────────
  private displayChangelog(containerEl: HTMLElement, t: ReturnType<typeof getLang>): void {
    const logList = containerEl.createDiv("random-review-changelog");
    t.updateLogItems.forEach((item) => {
      const li = logList.createDiv("changelog-item");
      li.createSpan("changelog-version").setText(item.version);
      li.createSpan("changelog-text").setText(item.text);
    });
  }

  // ──────────────────────────────────────────
  // 抽取控制选项卡（原有设置内容）
  // ──────────────────────────────────────────
  private displayExtraction(containerEl: HTMLElement, t: ReturnType<typeof getLang>): void {
    // ── 配置档案（置顶） ──
    this.renderProfileSection(containerEl, t);

    // ── 笔记筛选 ──
    new Setting(containerEl).setName(t.noteFilterHeading).setHeading();

    // 目标文件夹
    new Setting(containerEl)
      .setName(t.targetFolder)
      .setDesc(t.targetFolderDesc)
      .addDropdown((dropdown) => {
        const folders = getSubFolders(this.app, "", false);
        dropdown.addOption("", t.selectFolder);
        folders.forEach((folder) => {
          const depth = folderDepth(folder.path, "");
          const name = folder.path.split("/").pop() || folder.path;
          const indent = depth > 0 ? "└ ".repeat(depth) : "";
          dropdown.addOption(folder.path, indent + name);
        });
        dropdown.setValue(this.plugin.settings.folderPath);
        dropdown.onChange(async (value) => {
          this.plugin.settings.folderPath = value;
          await this.plugin.saveSettings();
          this.display();
        });
      });

    // 排除文件夹
    new Setting(containerEl).setName(t.excludeFoldersHeading).setHeading();
    if (!this.plugin.settings.folderPath) {
      containerEl.createEl("p", {
        text: t.needTargetFirst,
        cls: "setting-item-description",
      });
    } else {
      containerEl.createEl("p", {
        text: t.excludeFoldersDesc,
        cls: "setting-item-description",
      });
      const excludeContainer = containerEl.createDiv("exclude-folders-list");
      this.plugin.settings.excludeFolders.forEach((folderPath, index) => {
        const row = excludeContainer.createDiv("exclude-folder-row");
        const sw = row.createDiv("exclude-folder-select");
        createFolderSelect(
          this.app, sw, folderPath,
          this.plugin.settings.folderPath, false,
          (val) => {
            this.plugin.settings.excludeFolders[index] = val;
            void this.plugin.saveSettings();
          }
        );
        const rb = row.createEl("button", { cls: "exclude-folder-remove" });
        rb.setText("✕");
        rb.setAttr("aria-label", t.remove);
        rb.addEventListener("click", () => {
          this.plugin.settings.excludeFolders.splice(index, 1);
          void this.plugin.saveSettings().then(() => this.display());
        });
      });
      new Setting(containerEl).addButton((btn) =>
        btn.setButtonText(t.addExcludeFolder).onClick(async () => {
          this.plugin.settings.excludeFolders.push("");
          await this.plugin.saveSettings();
          this.display();
        })
      );
    }

    // 包含标签
    new Setting(containerEl)
      .setName(t.includeTags)
      .setDesc(t.includeTagsDesc)
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
      .setName(t.excludeTags)
      .setDesc(t.excludeTagsDesc)
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

    // ── 属性筛选（条件组） ──
    new Setting(containerEl).setName(t.propertyFilterHeading).setHeading();
    containerEl.createEl("p", {
      text: t.propertyFilterDesc,
      cls: "setting-item-description",
    });
    const groupsEl = containerEl.createDiv("property-groups");
    // 只重建属性组区域，避免整页 display() 导致设置滚动条跳到顶部
    const refresh = (): void => {
      groupsEl.empty();
      this.plugin.settings.propertyGroups.forEach((group, i) => {
        this.renderPropertyGroup(groupsEl, group, i, t, refresh);
      });
    };
    refresh();
    new Setting(containerEl).addButton((btn) =>
      btn.setButtonText(t.addPropertyGroup).onClick(() => {
        this.plugin.settings.propertyGroups.push({
          count: 0,
          conditions: [{ key: "", value: "", operator: "equals" }],
        });
        void this.plugin.saveSettings().then(refresh);
      })
    );

    // ── 抽取规则 ──
    new Setting(containerEl).setName(t.extractionRuleHeading).setHeading();
    new Setting(containerEl)
      .setName(t.pickCount)
      .setDesc(t.pickCountDesc)
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
      .setName(t.randomOrder)
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.randomOrder).onChange(async (v) => {
          this.plugin.settings.randomOrder = v;
          await this.plugin.saveSettings();
        })
      );

    // ── 显示设置 ──
    new Setting(containerEl).setName(t.displayHeading).setHeading();
    new Setting(containerEl)
      .setName(t.answerDefaultCollapsed)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.answerDefaultCollapsed)
          .onChange(async (v) => {
            this.plugin.settings.answerDefaultCollapsed = v;
            await this.plugin.saveSettings();
          })
      );
    new Setting(containerEl)
      .setName(t.showNavigationBar)
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showNavigationBar).onChange(async (v) => {
          this.plugin.settings.showNavigationBar = v;
          await this.plugin.saveSettings();
        })
      );
  }

  // ──────────────────────────────────────────
  // 配置档案
  // ──────────────────────────────────────────

  private renderProfileSection(
    containerEl: HTMLElement,
    t: ReturnType<typeof getLang>
  ): void {
    const s = this.plugin.settings;
    const active = this.plugin.getActiveProfile();

    new Setting(containerEl).setName(t.profileHeading).setHeading();
    containerEl.createEl("p", {
      text: t.profileDesc,
      cls: "setting-item-description",
    });

    let nameInput!: HTMLInputElement;

    // 档案选择器
    new Setting(containerEl)
      .setName(t.profileSelect)
      .addDropdown((dd) => {
        dd.addOption("", t.selectProfile);
        s.profiles.forEach((p) => {
          dd.addOption(p.id, p.name);
        });
        dd.setValue(s.activeProfileId ?? "");
        dd.onChange((id) => {
          void (async () => {
            const p = s.profiles.find((x) => x.id === id);
            if (!p) {
              this.plugin.clearActiveProfile();
              await this.plugin.saveSettings();
              this.display();
              return;
            }
            this.plugin.applyProfile(p);
            await this.plugin.saveSettings();
            this.display();
          })();
        });
      });

    // 档案名称 + 另存为
    new Setting(containerEl)
      .setName(t.profileName)
      .addText((text) => {
        text.setPlaceholder(t.profileNamePlaceholder);
        text.setValue(active?.name ?? "");
        nameInput = text.inputEl;
      })
      .addButton((btn) =>
        btn.setButtonText(t.profileSaveAs).onClick(() => {
          const name =
            nameInput.value.trim() ||
            s.folderPath.split("/").pop() ||
            t.profileNamePlaceholder;
          this.plugin.createProfile(name);
          void this.plugin.saveSettings().then(() => this.display());
        })
      );

    // 重命名 / 删除（仅当有激活档案）
    if (active) {
      new Setting(containerEl)
        .addButton((btn) =>
          btn.setButtonText(t.profileRename).onClick(() => {
            const name = nameInput.value.trim();
            if (name) {
              active.name = name;
              void this.plugin.saveSettings().then(() => this.display());
            }
          })
        )
        .addButton((btn) =>
          btn
            .setButtonText(t.profileDelete)
            .setDestructive()
            .onClick(() => {
              this.plugin.deleteProfile(active.id);
              void this.plugin.saveSettings().then(() => this.display());
            })
        );
    }
  }

  // ──────────────────────────────────────────
  // 属性筛选（条件组）UI
  // ──────────────────────────────────────────
  private renderPropertyGroup(
    parent: HTMLElement,
    group: PropertyGroup,
    index: number,
    t: ReturnType<typeof getLang>,
    onRefresh: () => void
  ): void {
    const box = parent.createDiv("property-group");

    // 组头：组名 + 抽取数量 + 删除组
    const header = box.createDiv("property-group-header");
    header.createSpan("property-group-title").setText(
      `${t.propertyGroupTitle} ${index + 1}`
    );
    header.createSpan("property-group-count-label").setText(t.propertyCount);
    const countInput = header.createEl("input", {
      type: "text",
      cls: "property-count-input",
      value: String(group.count || ""),
      placeholder: "0",
    });
    countInput.setAttr("aria-label", t.propertyCount);
    countInput.addEventListener("input", () => {
      const n = parseInt(countInput.value);
      group.count = isNaN(n) ? 0 : Math.max(0, n);
      void this.plugin.saveSettings();
    });
    const removeBtn = header.createEl("button", {
      cls: "exclude-folder-remove",
      text: "✕",
    });
    removeBtn.setAttr("aria-label", t.remove);
    removeBtn.addEventListener("click", () => {
      const gi = this.plugin.settings.propertyGroups.indexOf(group);
      if (gi >= 0) this.plugin.settings.propertyGroups.splice(gi, 1);
      void this.plugin.saveSettings().then(onRefresh);
    });

    // 条件列表
    const condList = box.createDiv("property-conditions");
    group.conditions.forEach((cond) => {
      this.renderPropertyCondition(condList, group, cond, t, onRefresh);
    });

    const addCondBtn = box.createEl("button", {
      cls: "property-add-condition",
      text: t.addPropertyCondition,
    });
    addCondBtn.addEventListener("click", () => {
      group.conditions.push({ key: "", value: "", operator: "equals" });
      void this.plugin.saveSettings().then(onRefresh);
    });
  }

  private renderPropertyCondition(
    parent: HTMLElement,
    group: PropertyGroup,
    cond: PropertyCondition,
    t: ReturnType<typeof getLang>,
    onRefresh: () => void
  ): void {
    const row = parent.createDiv("property-condition-row");

    const opSelect = row.createEl("select");
    opSelect.addClass("dropdown");
    const ops: [PropertyOperator, string][] = [
      ["equals", t.operatorEquals],
      ["contains", t.operatorContains],
      ["not-equals", t.operatorNotEquals],
    ];
    ops.forEach(([value, label]) => {
      const opt = opSelect.createEl("option");
      opt.value = value;
      opt.text = label;
    });
    opSelect.value = cond.operator;
    opSelect.addEventListener("change", () => {
      cond.operator = opSelect.value as PropertyOperator;
      void this.plugin.saveSettings();
    });

    const keyInput = row.createEl("input", { type: "text" });
    keyInput.setAttr("placeholder", t.propertyKey);
    keyInput.value = cond.key;
    keyInput.addEventListener("input", () => {
      cond.key = keyInput.value;
      void this.plugin.saveSettings();
    });

    const valueInput = row.createEl("input", { type: "text" });
    valueInput.setAttr("placeholder", t.propertyValue);
    valueInput.value = cond.value;
    valueInput.addEventListener("input", () => {
      cond.value = valueInput.value;
      void this.plugin.saveSettings();
    });

    const removeBtn = row.createEl("button", {
      cls: "exclude-folder-remove",
      text: "✕",
    });
    removeBtn.setAttr("aria-label", t.removeCondition);
    removeBtn.addEventListener("click", () => {
      const gi = this.plugin.settings.propertyGroups.indexOf(group);
      if (gi >= 0) {
        const conds = this.plugin.settings.propertyGroups[gi].conditions;
        const ci = conds.indexOf(cond);
        if (ci >= 0) conds.splice(ci, 1);
      }
      void this.plugin.saveSettings().then(onRefresh);
    });
  }
}
