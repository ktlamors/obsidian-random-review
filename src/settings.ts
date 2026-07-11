import {
  App,
  PluginSettingTab,
  Setting,
  TFolder,
  TAbstractFile,
} from "obsidian";
import type RandomReviewPlugin from "./main";
import { DEFAULT_PROFILE } from "./constants";

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

  constructor(app: App, plugin: RandomReviewPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // ── 笔记筛选 ──
    new Setting(containerEl).setName("笔记筛选").setHeading();

    // 目标文件夹
    new Setting(containerEl)
      .setName("目标文件夹")
      .setDesc("从中抽取笔记的文件夹，切换时自动保存当前配置")
      .addDropdown((dropdown) => {
        const folders = getSubFolders(this.app, "", false);
        dropdown.addOption("", "— 请选择 —");
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
      new Setting(containerEl).setName("历史配置档案").setHeading();
      containerEl.createEl("p", {
        text: "点击切换配置，右键删除",
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

        tag.addEventListener("click", async () => {
          this.saveCurrentToProfile();
          this.plugin.settings.folderPath = path;
          this.loadProfile(path);
          await this.plugin.saveSettings();
          this.display();
        });

        tag.addEventListener("contextmenu", async (e) => {
          e.preventDefault();
          delete this.plugin.settings.profiles[path];
          if (this.plugin.settings.folderPath === path) {
            this.plugin.settings.folderPath = "";
          }
          await this.plugin.saveSettings();
          this.display();
        });
      });

      const hint = containerEl.createEl("p", { cls: "profile-hint" });
      hint.setText("右键点击档案标签可删除");
    }

    // 排除文件夹
    new Setting(containerEl).setName("排除文件夹").setHeading();
    if (!this.plugin.settings.folderPath) {
      containerEl.createEl("p", {
        text: "请先选择目标文件夹",
        cls: "setting-item-description",
      });
    } else {
      containerEl.createEl("p", {
        text: "以下文件夹内的笔记不会被抽取",
        cls: "setting-item-description",
      });
      const excludeContainer = containerEl.createDiv("exclude-folders-list");
      this.plugin.settings.excludeFolders.forEach((folderPath, index) => {
        const row = excludeContainer.createDiv("exclude-folder-row");
        const sw = row.createDiv("exclude-folder-select");
        createFolderSelect(
          this.app, sw, folderPath,
          this.plugin.settings.folderPath, false,
          async (val) => {
            this.plugin.settings.excludeFolders[index] = val;
            await this.plugin.saveSettings();
          }
        );
        const rb = row.createEl("button", { cls: "exclude-folder-remove" });
        rb.setText("✕");
        rb.setAttr("aria-label", "移除");
        rb.addEventListener("click", async () => {
          this.plugin.settings.excludeFolders.splice(index, 1);
          await this.plugin.saveSettings();
          this.display();
        });
      });
      new Setting(containerEl).addButton((btn) =>
        btn.setButtonText("+ 添加排除文件夹").onClick(async () => {
          this.plugin.settings.excludeFolders.push("");
          await this.plugin.saveSettings();
          this.display();
        })
      );
    }

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
    new Setting(containerEl).setName("属性筛选").setHeading();
    containerEl.createEl("p", {
      text: "按属性分别抽取，各条件独立匹配（OR），合并后随机排列",
      cls: "setting-item-description",
    });
    this.plugin.settings.propertyFilters.forEach((filter, index) => {
      this.addPropertyFilterSetting(containerEl, filter, index);
    });
    new Setting(containerEl).addButton((btn) =>
      btn.setButtonText("+ 添加属性筛选").onClick(async () => {
        this.plugin.settings.propertyFilters.push({
          key: "", value: "", operator: "equals", count: 0,
        });
        await this.plugin.saveSettings();
        this.display();
      })
    );

    // ── 抽取规则 ──
    new Setting(containerEl).setName("抽取规则").setHeading();
    new Setting(containerEl)
      .setName("抽取数量")
      .setDesc("未设置属性筛选时的默认抽取数量")
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
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.randomOrder).onChange(async (v) => {
          this.plugin.settings.randomOrder = v;
          await this.plugin.saveSettings();
        })
      );

    // ── 显示设置 ──
    new Setting(containerEl).setName("显示设置").setHeading();
    new Setting(containerEl)
      .setName("答案默认折叠")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.answerDefaultCollapsed)
          .onChange(async (v) => {
            this.plugin.settings.answerDefaultCollapsed = v;
            await this.plugin.saveSettings();
          })
      );
    new Setting(containerEl)
      .setName("显示导航栏")
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
      propertyFilters: this.plugin.settings.propertyFilters.map((f) => ({ ...f })),
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
      this.plugin.settings.propertyFilters = saved.propertyFilters.map((f) => ({ ...f }));
      this.plugin.settings.pickCount = saved.pickCount;
      this.plugin.settings.randomOrder = saved.randomOrder;
    } else {
      this.plugin.settings.excludeFolders = [...DEFAULT_PROFILE.excludeFolders];
      this.plugin.settings.includeTags = [...DEFAULT_PROFILE.includeTags];
      this.plugin.settings.excludeTags = [...DEFAULT_PROFILE.excludeTags];
      this.plugin.settings.propertyFilters = DEFAULT_PROFILE.propertyFilters.map((f) => ({ ...f }));
      this.plugin.settings.pickCount = DEFAULT_PROFILE.pickCount;
      this.plugin.settings.randomOrder = DEFAULT_PROFILE.randomOrder;
    }
  }

  // ──────────────────────────────────────────
  // 属性筛选行
  // ──────────────────────────────────────────
  private addPropertyFilterSetting(
    containerEl: HTMLElement,
    filter: { key: string; value: string; operator: string; count: number },
    index: number
  ): void {
    const setting = new Setting(containerEl);
    setting.addText((text) =>
      text.setPlaceholder("属性名").setValue(filter.key).onChange(async (v) => {
        this.plugin.settings.propertyFilters[index].key = v;
        await this.plugin.saveSettings();
      })
    );
    setting.addText((text) =>
      text.setPlaceholder("属性值").setValue(filter.value).onChange(async (v) => {
        this.plugin.settings.propertyFilters[index].value = v;
        await this.plugin.saveSettings();
      })
    );
    setting.addText((text) => {
      text.setPlaceholder("数量").setValue(String(filter.count || "")).onChange(async (v) => {
        const n = parseInt(v);
        this.plugin.settings.propertyFilters[index].count = isNaN(n) ? 0 : Math.max(0, n);
        await this.plugin.saveSettings();
      });
      text.inputEl.addClass("property-count-input");
    });
    setting.addExtraButton((btn) =>
      btn.setIcon("cross").setTooltip("移除").onClick(async () => {
        this.plugin.settings.propertyFilters.splice(index, 1);
        await this.plugin.saveSettings();
        this.display();
      })
    );
  }
}
