import {
  App,
  PluginSettingTab,
  Setting,
  TFolder,
  TAbstractFile,
} from "obsidian";
import type RandomReviewPlugin from "./main";

/**
 * 获取 vault 中所有文件夹，按路径排序
 */
function getAllFolders(app: App): TFolder[] {
  const folders: TFolder[] = [];
  app.vault.getAllLoadedFiles().forEach((file: TAbstractFile) => {
    if (file instanceof TFolder) {
      folders.push(file);
    }
  });
  return folders.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * 创建文件夹下拉选择框
 * 用缩进展示层级结构
 */
function createFolderSelect(
  app: App,
  containerEl: HTMLElement,
  selectedPath: string,
  onChange: (path: string) => void
): HTMLSelectElement {
  const select = containerEl.createEl("select");
  select.style.width = "100%";

  const folders = getAllFolders(app);

  // 空选项
  const emptyOpt = select.createEl("option");
  emptyOpt.value = "";
  emptyOpt.text = "— 未选择 —";

  // 按层级渲染
  folders.forEach((folder) => {
    if (folder.path === "/") return; // 跳过根目录

    const opt = select.createEl("option");
    opt.value = folder.path;

    // 用缩进箭头表示层级
    const depth = folder.path.split("/").length - 1;
    const name = folder.path.split("/").pop() || folder.path;
    const indent = depth > 0 ? "└ ".repeat(depth) : "";
    opt.text = indent + name;

    if (folder.path === selectedPath) {
      opt.selected = true;
    }
  });

  select.addEventListener("change", () => {
    onChange(select.value);
  });

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
    containerEl.createEl("h2", { text: "笔记筛选" });

    // 目标文件夹 — 下拉选择
    new Setting(containerEl)
      .setName("目标文件夹")
      .setDesc("从中抽取笔记的文件夹")
      .addDropdown((dropdown) => {
        const folders = getAllFolders(this.app);

        dropdown.addOption("", "— 请选择 —");
        folders.forEach((folder) => {
          if (folder.path === "/") return;
          const depth = folder.path.split("/").length - 1;
          const name = folder.path.split("/").pop() || folder.path;
          const indent = depth > 0 ? "└ ".repeat(depth) : "";
          dropdown.addOption(folder.path, indent + name);
        });

        dropdown.setValue(this.plugin.settings.folderPath);
        dropdown.onChange(async (value) => {
          this.plugin.settings.folderPath = value;
          await this.plugin.saveSettings();
        });
      });

    // 排除文件夹
    containerEl.createEl("h3", { text: "排除文件夹" });
    containerEl.createEl("p", {
      text: "以下文件夹内的笔记不会被抽取",
      cls: "setting-item-description",
    });

    const excludeContainer = containerEl.createDiv("exclude-folders-list");

    this.plugin.settings.excludeFolders.forEach((folderPath, index) => {
      const row = excludeContainer.createDiv("exclude-folder-row");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "8px";
      row.style.marginBottom = "6px";

      const selectWrapper = row.createDiv();
      selectWrapper.style.flex = "1";

      createFolderSelect(this.app, selectWrapper, folderPath, async (val) => {
        this.plugin.settings.excludeFolders[index] = val;
        await this.plugin.saveSettings();
      });

      // 移除按钮
      const removeBtn = row.createEl("button");
      removeBtn.setText("✕");
      removeBtn.setAttr("aria-label", "移除");
      removeBtn.style.cssText =
        "background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:1.2em;padding:0 4px;";
      removeBtn.addEventListener("click", async () => {
        this.plugin.settings.excludeFolders.splice(index, 1);
        await this.plugin.saveSettings();
        this.display();
      });
    });

    // 添加排除文件夹
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
      text: "多个条件同时满足（AND）",
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
  // 属性筛选行
  // ──────────────────────────────────────────
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
