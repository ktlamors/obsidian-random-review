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
  settings!: RandomReviewSettings;

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
      (this.app.workspace as any).on(
        "file-menu",
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
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);

    // 迁移旧数据：确保 profiles 存在
    if (!this.settings.profiles) {
      this.settings.profiles = {};
    }

    // 迁移旧数据：确保所有 propertyFilters 有 count 字段
    const fixCount = (filters: any[]) => {
      filters.forEach((f) => {
        if (f.count === undefined) f.count = 0;
      });
    };
    fixCount(this.settings.propertyFilters);
    Object.values(this.settings.profiles).forEach((p: any) => {
      if (p.propertyFilters) fixCount(p.propertyFilters);
    });

    await this.saveSettings();
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
