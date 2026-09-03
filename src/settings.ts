import {
  App,
  PluginSettingTab,
  Setting,
  TFolder,
  TAbstractFile,
} from "obsidian";
import type RandomReviewPlugin from "./main";
import {
  DEFAULT_PROFILE,
  PropertyGroup,
  PropertyCondition,
  PropertyOperator,
} from "./constants";
import { getLang, Language } from "./i18n";

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
  private activeTab: "general" | "extraction" = "extraction";

  constructor(app: App, plugin: RandomReviewPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const t = getLang(this.plugin.settings.language);

    // ── 选项卡栏 ──
    const tabBar = containerEl.createDiv("random-review-tabs");
    const makeTab = (key: "general" | "extraction", label: string): void => {
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

    const contentEl = containerEl.createDiv("random-review-tab-content");

    if (this.activeTab === "general") {
      this.displayGeneral(contentEl, t);
    } else {
      this.displayExtraction(contentEl, t);
    }
  }

  // ──────────────────────────────────────────
  // 通用选项卡
  // ──────────────────────────────────────────
  private displayGeneral(containerEl: HTMLElement, t: ReturnType<typeof getLang>): void {
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

    new Setting(containerEl).setName(t.updateLogTitle).setHeading();
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
          this.saveCurrentToProfile();
          this.plugin.settings.folderPath = value;
          this.loadProfile(value);
          await this.plugin.saveSettings();
          this.display();
        });
      });

    // 配置档案
    const profileKeys = Object.keys(this.plugin.settings.profiles);
    if (profileKeys.length > 0) {
      new Setting(containerEl).setName(t.profileHeading).setHeading();
      containerEl.createEl("p", {
        text: t.profileDesc,
        cls: "setting-item-description",
      });

      const profileList = containerEl.createDiv("profile-tag-list");

      profileKeys.forEach((path) => {
        const tag = profileList.createEl("button", { cls: "profile-tag" });
        const shortName = path.split("/").pop() || path;
        tag.setText(shortName);
        tag.setAttr("title", path);

        if (path === this.plugin.settings.folderPath) {
          tag.addClass("profile-tag-active");
        }

        tag.addEventListener("click", () => {
          void (async () => {
            this.saveCurrentToProfile();
            this.plugin.settings.folderPath = path;
            this.loadProfile(path);
            await this.plugin.saveSettings();
            this.display();
          })();
        });

        tag.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          void (async () => {
            delete this.plugin.settings.profiles[path];
            if (this.plugin.settings.folderPath === path) {
              this.plugin.settings.folderPath = "";
            }
            await this.plugin.saveSettings();
            this.display();
          })();
        });
      });

      const hint = containerEl.createEl("p", { cls: "profile-hint" });
      hint.setText(t.profileHint);
    }

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

  private saveCurrentToProfile(): void {
    const path = this.plugin.settings.folderPath;
    if (!path) return;
    this.plugin.settings.profiles[path] = {
      excludeFolders: [...this.plugin.settings.excludeFolders],
      includeTags: [...this.plugin.settings.includeTags],
      excludeTags: [...this.plugin.settings.excludeTags],
      propertyGroups: this.plugin.settings.propertyGroups.map((g) => ({
        count: g.count,
        conditions: g.conditions.map((c) => ({ ...c })),
      })),
      pickCount: this.plugin.settings.pickCount,
      randomOrder: this.plugin.settings.randomOrder,
    };
  }

  private loadProfile(folderPath: string): void {
    const saved = this.plugin.settings.profiles[folderPath];
    if (saved) {
      this.plugin.settings.excludeFolders = [...saved.excludeFolders];
      this.plugin.settings.includeTags = [...saved.includeTags];
      this.plugin.settings.excludeTags = [...saved.excludeTags];
      this.plugin.settings.propertyGroups = saved.propertyGroups.map((g) => ({
        count: g.count,
        conditions: g.conditions.map((c) => ({ ...c })),
      }));
      this.plugin.settings.pickCount = saved.pickCount;
      this.plugin.settings.randomOrder = saved.randomOrder;
    } else {
      this.plugin.settings.excludeFolders = [...DEFAULT_PROFILE.excludeFolders];
      this.plugin.settings.includeTags = [...DEFAULT_PROFILE.includeTags];
      this.plugin.settings.excludeTags = [...DEFAULT_PROFILE.excludeTags];
      this.plugin.settings.propertyGroups = DEFAULT_PROFILE.propertyGroups.map((g) => ({
        count: g.count,
        conditions: g.conditions.map((c) => ({ ...c })),
      }));
      this.plugin.settings.pickCount = DEFAULT_PROFILE.pickCount;
      this.plugin.settings.randomOrder = DEFAULT_PROFILE.randomOrder;
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
